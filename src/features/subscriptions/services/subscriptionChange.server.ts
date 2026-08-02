import 'server-only'

import type { Db, ObjectId as ObjectIdType } from 'mongodb'
import { ObjectId } from 'mongodb'

import { normalizePlanEntitlements } from '@features/subscription-plans/featureCatalog'
import { entitlementsSnapshotFromPlanDoc } from '@features/subscription-plans/services/planCatalogEdit.server'

import {
  SUBSCRIPTION_CHANGE_COPY,
  appliesImmediately,
  classifyPlanChange,
  estimateUpgradeProration,
  findDowngradeUsageBlocks,
  priceForInterval,
  type PricedPlanRef
} from '../subscriptionChangePolicy'
import type { BillingInterval, TenantSubscription } from '../subscriptions.types'
import { countTenantUsage, serializeTenantSubscription } from './entitlements.server'

function periodLengthDays(interval: BillingInterval) {
  return interval === 'yearly' ? 365 : 30
}

function toPricedPlan(doc: Record<string, any>): PricedPlanRef {
  const entitlements = normalizePlanEntitlements(doc.entitlements || doc, doc.maxUsers)

  return {
    _id: String(doc._id),
    name: String(doc.name || ''),
    priceMonthly: Number(doc.priceMonthly) || 0,
    priceYearly: typeof doc.priceYearly === 'number' ? doc.priceYearly : null,
    currency: String(doc.currency || 'INR'),
    entitlements
  }
}

async function loadPlan(db: Db, planId: ObjectIdType) {
  const doc = await db.collection('subscriptionPlans').findOne({ _id: planId, isActive: true })

  return doc ? toPricedPlan(doc as any) : null
}

function nextPeriodBounds(from: Date, interval: BillingInterval) {
  const days = periodLengthDays(interval)
  const start = from
  const end = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)

  return { start, end }
}

export type ChangePlanResult =
  | {
      ok: true
      mode: 'immediate' | 'scheduled'
      subscription: TenantSubscription
      prorationNote: string | null
      message: string
      usageWarnings?: Array<{ key: string; used: number; limit: number }>
    }
  | {
      ok: false
      error: string
      message: string
      usageBlocks?: Array<{ key: string; used: number; limit: number }>
    }

/**
 * Owner/self-serve plan change per locked policy.
 * Upgrades (and trial / lateral) apply now; downgrades schedule for period end.
 */
export async function changeTenantSubscriptionPlan(params: {
  db: Db
  tenantId: ObjectIdType
  actorUserId: ObjectIdType
  targetPlanId: string
  billingInterval?: BillingInterval
  /** Super Admin: apply downgrades / lateral moves immediately */
  forceImmediate?: boolean
}): Promise<ChangePlanResult> {
  const { db, tenantId, targetPlanId, forceImmediate = false } = params
  const now = new Date()

  if (!ObjectId.isValid(targetPlanId)) {
    return { ok: false, error: 'invalid_plan', message: 'Invalid plan id' }
  }

  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  // Legacy orgs may only have tenants.subscriptionPlanId — start a live subscription row.
  if (!sub) {
    const { createTenantSubscription } = await import('./tenantSubscription.server')
    const created = await createTenantSubscription({
      db,
      tenantId,
      planId: new ObjectId(targetPlanId),
      ownerUserId: params.actorUserId,
      billingInterval: params.billingInterval || 'monthly',
      trialEnabled: false
    })

    return {
      ok: true,
      mode: 'immediate',
      subscription: created,
      prorationNote: SUBSCRIPTION_CHANGE_COPY.paymentsPending,
      message: 'Subscription started on the selected plan.'
    }
  }

  const currentPlanDoc = await db.collection('subscriptionPlans').findOne({ _id: sub.planId as ObjectId })
  const currentPlan = currentPlanDoc ? toPricedPlan(currentPlanDoc as any) : null
  const targetPlan = await loadPlan(db, new ObjectId(targetPlanId))

  if (!currentPlan || !targetPlan) {
    return { ok: false, error: 'plan_not_found', message: 'Plan not found or inactive' }
  }

  const currentInterval = (sub.billingInterval || 'monthly') as BillingInterval
  const nextInterval = params.billingInterval || currentInterval
  const inTrial = sub.status === 'trialing'
  const kind = classifyPlanChange({
    currentPlanId: String(sub.planId),
    targetPlanId: targetPlan._id,
    current: currentPlan,
    target: targetPlan,
    billingInterval: currentInterval,
    nextBillingInterval: nextInterval
  })

  if (kind === 'same') {
    return { ok: false, error: 'same_plan', message: 'You are already on this plan and billing interval' }
  }

  const usage = await countTenantUsage(db, tenantId)
  const usageBlocks = findDowngradeUsageBlocks(usage, targetPlan.entitlements)

  const immediate = forceImmediate || appliesImmediately(kind, inTrial)

  // Hard-block only when applying immediately would put them on a smaller plan while over limit.
  // Super Admin forceImmediate still warns but allows over-limit (soft-locks after).
  if (usageBlocks.length > 0 && immediate && !forceImmediate) {
    return {
      ok: false,
      error: 'usage_exceeds_target',
      message: SUBSCRIPTION_CHANGE_COPY.usageBlocked,
      usageBlocks
    }
  }

  if (immediate) {
    const targetPlanDoc = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(targetPlan._id) })
    const snap = entitlementsSnapshotFromPlanDoc(targetPlanDoc as any)

    const update: Record<string, unknown> = {
      planId: new ObjectId(targetPlan._id),
      billingInterval: nextInterval,
      pendingPlanId: null,
      pendingBillingInterval: null,
      pendingChangeEffectiveAt: null,
      pendingChangeKind: null,
      cancelAtPeriodEnd: false,
      canceledAt: null,
      entitlementsSnapshot: snap?.entitlementsSnapshot ?? null,
      entitlementsVersion: snap?.entitlementsVersion ?? null,
      updatedAt: now
    }

    // Monthly → yearly (or trial leave): start a fresh period on the new interval
    if (inTrial || (currentInterval === 'monthly' && nextInterval === 'yearly') || kind === 'upgrade') {
      if (!inTrial && currentInterval === 'monthly' && nextInterval === 'yearly') {
        const bounds = nextPeriodBounds(now, 'yearly')

        update.currentPeriodStart = bounds.start
        update.currentPeriodEnd = bounds.end
        update.status = 'active'
        update.trialStartsAt = null
        update.trialEndsAt = null
      } else if (inTrial && kind === 'upgrade') {
        // Keep remaining trial window; plan rights change now
      } else if (!inTrial && kind === 'upgrade') {
        // Keep current period end; entitlements change now (proration later)
      }
    }

    await db.collection('tenantSubscriptions').updateOne({ _id: sub._id }, { $set: update })
    await db.collection('tenants').updateOne(
      { _id: tenantId },
      { $set: { subscriptionPlanId: new ObjectId(targetPlan._id), updatedAt: now } }
    )

    const proration = estimateUpgradeProration({
      currentPrice: priceForInterval(currentPlan, currentInterval),
      targetPrice: priceForInterval(targetPlan, nextInterval),
      currency: targetPlan.currency || 'INR',
      periodStart: sub.currentPeriodStart instanceof Date ? sub.currentPeriodStart : new Date(sub.currentPeriodStart),
      periodEnd: sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd),
      now
    })

    const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

    return {
      ok: true,
      mode: 'immediate',
      subscription: serializeTenantSubscription(updated as any),
      prorationNote: kind === 'upgrade' && !inTrial ? proration.note : inTrial ? SUBSCRIPTION_CHANGE_COPY.trialSwitch : SUBSCRIPTION_CHANGE_COPY.paymentsPending,
      message: inTrial
        ? SUBSCRIPTION_CHANGE_COPY.trialSwitch
        : kind === 'upgrade'
          ? SUBSCRIPTION_CHANGE_COPY.upgrade
          : forceImmediate
            ? 'Plan updated immediately.'
            : 'Plan updated.',
      usageWarnings: forceImmediate && usageBlocks.length > 0 ? usageBlocks : undefined
    }
  }

  // Schedule downgrade / yearly→monthly for period end
  let periodEnd = sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd)
  const periodPatch: Record<string, unknown> = {}

  // If the billing period already ended, roll it forward so the downgrade stays deferred
  // (otherwise the next page load would apply it immediately via applyDueSubscriptionChanges).
  if (!Number.isFinite(periodEnd.getTime()) || periodEnd.getTime() <= now.getTime()) {
    const bounds = nextPeriodBounds(now, currentInterval)

    periodPatch.currentPeriodStart = bounds.start
    periodPatch.currentPeriodEnd = bounds.end
    periodEnd = bounds.end
  }

  await db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        ...periodPatch,
        pendingPlanId: new ObjectId(targetPlan._id),
        pendingBillingInterval: nextInterval,
        pendingChangeEffectiveAt: periodEnd,
        pendingChangeKind: kind === 'lateral' ? 'lateral' : 'downgrade',
        cancelAtPeriodEnd: false,
        canceledAt: null,
        updatedAt: now
      }
    }
  )

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

  return {
    ok: true,
    mode: 'scheduled',
    subscription: serializeTenantSubscription(updated as any),
    prorationNote: null,
    message: `Downgrade activated to ${targetPlan.name}. It will take effect on ${periodEnd.toISOString().slice(0, 10)}. You can cancel the downgrade anytime before then.`,
    usageWarnings: usageBlocks.length > 0 ? usageBlocks : undefined
  }
}

export async function scheduleTenantSubscriptionCancel(params: {
  db: Db
  tenantId: ObjectIdType
  /** Super Admin: expire access immediately */
  forceImmediate?: boolean
}): Promise<ChangePlanResult> {
  const { db, tenantId, forceImmediate = false } = params
  const now = new Date()

  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No active subscription found' }
  }

  if (forceImmediate) {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: sub._id },
      {
        $set: {
          status: 'expired',
          cancelAtPeriodEnd: false,
          canceledAt: now,
          pendingPlanId: null,
          pendingBillingInterval: null,
          pendingChangeEffectiveAt: null,
          pendingChangeKind: null,
          updatedAt: now
        }
      }
    )

    const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

    return {
      ok: true,
      mode: 'immediate',
      subscription: serializeTenantSubscription(updated as any),
      prorationNote: null,
      message: 'Subscription cancelled immediately. Access has ended.'
    }
  }

  // Trial: end access at trial end (already period end)
  await db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        cancelAtPeriodEnd: true,
        canceledAt: now,
        // Clear pending downgrade — cancel wins
        pendingPlanId: null,
        pendingBillingInterval: null,
        pendingChangeEffectiveAt: null,
        pendingChangeKind: null,
        updatedAt: now
      }
    }
  )

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })
  const interval = (sub.billingInterval || 'monthly') as BillingInterval
  const message =
    interval === 'yearly' ? SUBSCRIPTION_CHANGE_COPY.cancelAnnual : SUBSCRIPTION_CHANGE_COPY.cancel

  return {
    ok: true,
    mode: 'scheduled',
    subscription: serializeTenantSubscription(updated as any),
    prorationNote: null,
    message
  }
}

export async function resumeTenantSubscription(params: {
  db: Db
  tenantId: ObjectIdType
}): Promise<ChangePlanResult> {
  const { db, tenantId } = params
  const now = new Date()

  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No active subscription found' }
  }

  if (!sub.cancelAtPeriodEnd) {
    return { ok: false, error: 'not_canceling', message: 'Subscription is not scheduled to cancel' }
  }

  await db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    { $set: { cancelAtPeriodEnd: false, canceledAt: null, updatedAt: now } }
  )

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

  return {
    ok: true,
    mode: 'immediate',
    subscription: serializeTenantSubscription(updated as any),
    prorationNote: null,
    message: 'Cancellation withdrawn. Your subscription will continue.'
  }
}

export async function clearPendingPlanChange(params: {
  db: Db
  tenantId: ObjectIdType
}): Promise<ChangePlanResult> {
  const { db, tenantId } = params
  const now = new Date()

  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No active subscription found' }
  }

  if (!sub.pendingPlanId) {
    return { ok: false, error: 'no_pending_change', message: 'No pending plan change to clear' }
  }

  await db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        pendingPlanId: null,
        pendingBillingInterval: null,
        pendingChangeEffectiveAt: null,
        pendingChangeKind: null,
        updatedAt: now
      }
    }
  )

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

  return {
    ok: true,
    mode: 'immediate',
    subscription: serializeTenantSubscription(updated as any),
    prorationNote: null,
    message: 'Scheduled downgrade cancelled. You remain on your current plan.'
  }
}

/**
 * Apply due period-end actions: cancel → expire; pending plan → switch + roll period; else roll period.
 * Called from entitlement resolution so renewals stay consistent without a separate cron (for now).
 */
export async function applyDueSubscriptionChanges(db: Db, tenantId: ObjectIdType, subDoc: Record<string, any>) {
  const now = new Date()
  const periodEnd = subDoc.currentPeriodEnd instanceof Date ? subDoc.currentPeriodEnd : new Date(subDoc.currentPeriodEnd)
  const pendingEffectiveRaw = subDoc.pendingChangeEffectiveAt
  const pendingEffectiveAt =
    pendingEffectiveRaw instanceof Date
      ? pendingEffectiveRaw
      : pendingEffectiveRaw
        ? new Date(pendingEffectiveRaw)
        : null

  // Pending downgrade not due yet — keep current plan even if an old period date lapsed.
  if (
    subDoc.pendingPlanId &&
    pendingEffectiveAt &&
    Number.isFinite(pendingEffectiveAt.getTime()) &&
    pendingEffectiveAt.getTime() > now.getTime()
  ) {
    if (!Number.isFinite(periodEnd.getTime()) || periodEnd.getTime() <= now.getTime()) {
      const interval = (subDoc.billingInterval || 'monthly') as BillingInterval
      const bounds = nextPeriodBounds(now, interval)
      // Keep period dates valid until the scheduled downgrade date (cap at pending effective).
      const rolledEnd = bounds.end.getTime() < pendingEffectiveAt.getTime() ? bounds.end : pendingEffectiveAt

      await db.collection('tenantSubscriptions').updateOne(
        { _id: subDoc._id },
        {
          $set: {
            currentPeriodStart: bounds.start,
            currentPeriodEnd: rolledEnd,
            updatedAt: now
          }
        }
      )

      return db.collection('tenantSubscriptions').findOne({ _id: subDoc._id })
    }

    return subDoc
  }

  if (!Number.isFinite(periodEnd.getTime()) || periodEnd.getTime() > now.getTime()) {
    return subDoc
  }

  // Cancelled at period end → expire
  if (subDoc.cancelAtPeriodEnd) {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: subDoc._id },
      { $set: { status: 'expired', updatedAt: now } }
    )

    return null
  }

  const interval = ((subDoc.pendingBillingInterval || subDoc.billingInterval || 'monthly') as BillingInterval)
  const bounds = nextPeriodBounds(now, interval)
  const update: Record<string, unknown> = {
    currentPeriodStart: bounds.start,
    currentPeriodEnd: bounds.end,
    updatedAt: now,
    lastPaymentStatus: 'none',
    // Payment provider renewal hook — no charge until connected
    pendingPlanId: null,
    pendingBillingInterval: null,
    pendingChangeEffectiveAt: null,
    pendingChangeKind: null
  }

  if (subDoc.pendingPlanId) {
    update.planId = subDoc.pendingPlanId
    update.billingInterval = interval
    await db.collection('tenants').updateOne(
      { _id: tenantId },
      { $set: { subscriptionPlanId: subDoc.pendingPlanId, updatedAt: now } }
    )
  } else if (subDoc.status === 'trialing') {
    // Trial ended without conversion path — expire (also handled elsewhere)
    await db.collection('tenantSubscriptions').updateOne(
      { _id: subDoc._id },
      { $set: { status: 'expired', updatedAt: now } }
    )

    return null
  } else {
    // Soft renew same plan until payments enforce collection
    update.billingInterval = subDoc.billingInterval || 'monthly'
  }

  if (subDoc.status === 'trialing' && subDoc.pendingPlanId) {
    update.status = 'active'
    update.trialStartsAt = null
    update.trialEndsAt = null
  }

  // Adopt latest catalog entitlements at period end (catalog reductions take effect here).
  const nextPlanId = (update.planId as ObjectId | undefined) || (subDoc.planId as ObjectId)
  const planDoc = await db.collection('subscriptionPlans').findOne({ _id: nextPlanId })
  const snap = entitlementsSnapshotFromPlanDoc(planDoc as any)

  if (snap) {
    update.entitlementsSnapshot = snap.entitlementsSnapshot
    update.entitlementsVersion = snap.entitlementsVersion
  }

  await db.collection('tenantSubscriptions').updateOne({ _id: subDoc._id }, { $set: update })

  return db.collection('tenantSubscriptions').findOne({ _id: subDoc._id })
}

const MANUAL_PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'other', 'complimentary'] as const

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number]

/**
 * Super Admin: assign a plan (create subscription if missing, else change with optional forceImmediate).
 */
export async function assignTenantPlan(params: {
  db: Db
  tenantId: ObjectIdType
  actorUserId: ObjectIdType
  targetPlanId: string
  billingInterval?: BillingInterval
  forceImmediate?: boolean
  trialEnabled?: boolean
}): Promise<ChangePlanResult> {
  return changeTenantSubscriptionPlan({
    db: params.db,
    tenantId: params.tenantId,
    actorUserId: params.actorUserId,
    targetPlanId: params.targetPlanId,
    billingInterval: params.billingInterval,
    forceImmediate: params.forceImmediate
  })
}

/**
 * Super Admin: extend this organisation's trial window only (does not change plan catalog trialDays).
 */
export async function extendTenantTrial(params: {
  db: Db
  tenantId: ObjectIdType
  days: number
}): Promise<ChangePlanResult> {
  const { db, tenantId } = params
  const days = Math.trunc(params.days)

  if (!Number.isFinite(days) || days < 1 || days > 365) {
    return { ok: false, error: 'invalid_days', message: 'Trial extension must be between 1 and 365 days' }
  }

  const now = new Date()
  let sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No active subscription found to extend' }
  }

  const periodEnd = sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd)
  const trialEnd = sub.trialEndsAt instanceof Date ? sub.trialEndsAt : sub.trialEndsAt ? new Date(sub.trialEndsAt) : null
  const base =
    sub.status === 'trialing' && trialEnd && Number.isFinite(trialEnd.getTime())
      ? trialEnd.getTime() > now.getTime()
        ? trialEnd
        : now
      : periodEnd.getTime() > now.getTime()
        ? periodEnd
        : now

  const newEnd = new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
  const trialStartsAt =
    sub.trialStartsAt instanceof Date
      ? sub.trialStartsAt
      : sub.trialStartsAt
        ? new Date(sub.trialStartsAt)
        : now

  await db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        status: 'trialing',
        trialStartsAt,
        trialEndsAt: newEnd,
        currentPeriodEnd: newEnd,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        updatedAt: now
      }
    }
  )

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

  return {
    ok: true,
    mode: 'immediate',
    subscription: serializeTenantSubscription(updated as any),
    prorationNote: null,
    message: `Trial extended by ${days} day${days === 1 ? '' : 's'} for this organisation (until ${newEnd.toISOString().slice(0, 10)}).`
  }
}

/**
 * Super Admin: record offline / promo payment, create GST invoice, email it, roll period.
 */
export async function recordManualPayment(params: {
  db: Db
  tenantId: ObjectIdType
  actorUserId: ObjectIdType
  method: ManualPaymentMethod
  note?: string | null
}): Promise<ChangePlanResult> {
  const { db, tenantId, actorUserId } = params

  if (!MANUAL_PAYMENT_METHODS.includes(params.method)) {
    return { ok: false, error: 'invalid_method', message: 'Invalid payment method' }
  }

  const now = new Date()
  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due', 'expired'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No subscription found to mark as paid' }
  }

  const interval = (sub.billingInterval || 'monthly') as BillingInterval
  const periodEnd = sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd)
  const rollFrom = Number.isFinite(periodEnd.getTime()) && periodEnd.getTime() > now.getTime() ? periodEnd : now
  const bounds = nextPeriodBounds(rollFrom, interval)
  const note =
    typeof params.note === 'string' && params.note.trim() ? params.note.trim().slice(0, 500) : null

  const plan = await db.collection('subscriptionPlans').findOne({ _id: sub.planId })

  if (!plan) {
    return { ok: false, error: 'plan_not_found', message: 'Subscription plan not found' }
  }

  const tenant = await db.collection('tenants').findOne({ _id: tenantId })
  const { createSubscriptionInvoice } = await import('@features/billing/services/invoices.server')
  const { finalizeSuccessfulPayment } = await import('@features/billing/services/payments.server')

  const invoice = await createSubscriptionInvoice({
    db,
    tenantId,
    subscriptionId: sub._id as ObjectIdType,
    plan: plan as any,
    billingInterval: interval,
    periodStart: bounds.start,
    periodEnd: bounds.end,
    provider: 'manual',
    discountSnapshot: (sub as any).discountSnapshot || null,
    billingContactEmail: (tenant as any)?.billingEmail || null,
    status: 'open'
  })

  // Period already computed; finalize without double-rolling
  await db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        status: 'active',
        trialStartsAt: null,
        trialEndsAt: null,
        currentPeriodStart: bounds.start,
        currentPeriodEnd: bounds.end,
        cancelAtPeriodEnd: false,
        canceledAt: null,
        updatedAt: now
      }
    }
  )

  await finalizeSuccessfulPayment({
    db,
    tenantId,
    subscriptionId: sub._id as ObjectIdType,
    invoiceId: new ObjectId(invoice._id),
    provider: 'manual',
    amountPaise: invoice.totalPaise,
    method: params.method,
    recordedBy: actorUserId,
    note,
    skipPeriodRoll: true
  })

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

  return {
    ok: true,
    mode: 'immediate',
    subscription: serializeTenantSubscription(updated as any),
    prorationNote: null,
    message: `Marked as paid (${params.method.replace('_', ' ')}). Invoice ${invoice.invoiceNumber} issued. Period until ${bounds.end.toISOString().slice(0, 10)}.`
  }
}
