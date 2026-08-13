import 'server-only'

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

import {
  LIMIT_FEATURES,
  TRIAL_DAYS,
  defaultPlanEntitlements,
  isUnlimited,
  normalizePlanEntitlements,
  type ModuleFeatureKey,
  type PlanEntitlements
} from '@features/subscription-plans/featureCatalog'
import { mergeEntitlementsPreferHigher } from '@features/subscription-plans/planCatalogEditPolicy'

import type {
  BillingInterval,
  DiscountSnapshot,
  RenewalMode,
  ResolvedEntitlements,
  SubscriptionStatus,
  TenantSubscription,
  UsageSnapshot
} from '../subscriptions.types'

const ACTIVE_STATUSES: SubscriptionStatus[] = ['trialing', 'active', 'past_due']

function toIso(d: unknown): string | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(String(d))

  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export function serializeTenantSubscription(doc: Record<string, any>): TenantSubscription {
  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    planId: String(doc.planId),
    status: doc.status as SubscriptionStatus,
    billingInterval: (doc.billingInterval || 'monthly') as BillingInterval,
    renewalMode: (doc.renewalMode || 'manual') as RenewalMode,
    trialStartsAt: toIso(doc.trialStartsAt),
    trialEndsAt: toIso(doc.trialEndsAt),
    currentPeriodStart: toIso(doc.currentPeriodStart) || new Date(0).toISOString(),
    currentPeriodEnd: toIso(doc.currentPeriodEnd) || new Date(0).toISOString(),
    cancelAtPeriodEnd: Boolean(doc.cancelAtPeriodEnd),
    canceledAt: toIso(doc.canceledAt),
    pendingPlanId: doc.pendingPlanId ? String(doc.pendingPlanId) : null,
    pendingBillingInterval: (doc.pendingBillingInterval as BillingInterval) || null,
    pendingChangeEffectiveAt: toIso(doc.pendingChangeEffectiveAt),
    pendingChangeKind: (doc.pendingChangeKind as TenantSubscription['pendingChangeKind']) || null,
    entitlementsSnapshot: doc.entitlementsSnapshot
      ? normalizePlanEntitlements(doc.entitlementsSnapshot)
      : null,
    entitlementsVersion:
      typeof doc.entitlementsVersion === 'number' && Number.isFinite(doc.entitlementsVersion)
        ? Math.trunc(doc.entitlementsVersion)
        : null,
    billingContactUserId: String(doc.billingContactUserId),
    billingContactNominatedBy: doc.billingContactNominatedBy ? String(doc.billingContactNominatedBy) : null,
    discountCodeId: doc.discountCodeId ? String(doc.discountCodeId) : null,
    discountSnapshot: (doc.discountSnapshot as DiscountSnapshot) || null,
    paymentProvider: doc.paymentProvider ?? null,
    externalCustomerId: doc.externalCustomerId ?? null,
    externalSubscriptionId: doc.externalSubscriptionId ?? null,
    externalPlanId: typeof doc.externalPlanId === 'string' ? doc.externalPlanId : null,
    externalSubscriptionStatus:
      typeof doc.externalSubscriptionStatus === 'string' ? doc.externalSubscriptionStatus : null,
    defaultPaymentMethodLabel:
      typeof doc.defaultPaymentMethodLabel === 'string' ? doc.defaultPaymentMethodLabel : null,
    lastPaymentStatus: (doc.lastPaymentStatus || 'none') as TenantSubscription['lastPaymentStatus'],
    lastPaymentMethod: (doc.lastPaymentMethod as TenantSubscription['lastPaymentMethod']) || null,
    lastPaymentNote: typeof doc.lastPaymentNote === 'string' ? doc.lastPaymentNote : null,
    lastPaymentAt: toIso(doc.lastPaymentAt),
    lastPaymentRecordedBy: doc.lastPaymentRecordedBy ? String(doc.lastPaymentRecordedBy) : null,
    reminderDaysBeforeDue: Array.isArray(doc.reminderDaysBeforeDue) ? doc.reminderDaysBeforeDue : [7, 3, 1],
    createdAt: toIso(doc.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(doc.updatedAt) || new Date(0).toISOString()
  }
}

/** Calendar month used for customer and lead quotas. Seats are not windowed. */
export function calendarMonthWindow(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0)

  return { start, end }
}

export async function countTenantUsage(db: Db, tenantId: ObjectId, now = new Date()): Promise<UsageSnapshot> {
  const { start, end } = calendarMonthWindow(now)
  const [users, customers, leads] = await Promise.all([
    db.collection('memberships').countDocuments({
      tenantId,
      status: { $in: ['active', 'invited'] }
    }),
    db.collection('customers').countDocuments({
      tenantId,
      createdAt: { $gte: start, $lt: end }
    }),
    db.collection('loanCases').countDocuments({
      tenantId,
      createdAt: { $gte: start, $lt: end }
    })
  ])

  return {
    users,
    customers,
    leads,
    monthlyWindow: { start: start.toISOString(), end: end.toISOString() }
  }
}

export async function getCurrentTenantSubscriptionDoc(db: Db, tenantId: ObjectId) {
  return db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ACTIVE_STATUSES } },
    { sort: { updatedAt: -1 } }
  )
}

export async function resolvePlanEntitlements(db: Db, planId: ObjectId | string | null | undefined): Promise<{
  planId: string | null
  planName: string | null
  entitlements: PlanEntitlements
  maxUsers: number
}> {
  if (!planId) {
    const entitlements = defaultPlanEntitlements()

    return { planId: null, planName: null, entitlements, maxUsers: entitlements.limits.maxUsers }
  }

  const id = typeof planId === 'string' ? planId : planId.toHexString()

  if (!ObjectId.isValid(id)) {
    const entitlements = defaultPlanEntitlements()

    return { planId: null, planName: null, entitlements, maxUsers: entitlements.limits.maxUsers }
  }

  const plan = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(id) })

  if (!plan) {
    const entitlements = defaultPlanEntitlements()

    return { planId: null, planName: null, entitlements, maxUsers: entitlements.limits.maxUsers }
  }

  const entitlements = normalizePlanEntitlements((plan as any).entitlements || plan, (plan as any).maxUsers)

  return {
    planId: id,
    planName: String((plan as any).name || ''),
    entitlements,
    maxUsers: entitlements.limits.maxUsers
  }
}

export async function resolveTenantEntitlements(db: Db, tenantId: ObjectId): Promise<ResolvedEntitlements> {
  const now = new Date()
  let subDoc = await getCurrentTenantSubscriptionDoc(db, tenantId)

  if (subDoc) {
    const { applyDueSubscriptionChanges } = await import('./subscriptionChange.server')
    const afterDue = await applyDueSubscriptionChanges(db, tenantId, subDoc as any)

    subDoc = afterDue as typeof subDoc
  }

  // Soft-expire trials that have passed (belt-and-suspenders if period end wasn't set)
  if (subDoc?.status === 'trialing' && subDoc.trialEndsAt instanceof Date && subDoc.trialEndsAt.getTime() < now.getTime()) {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: subDoc._id },
      { $set: { status: 'expired', updatedAt: now } }
    )
    subDoc = null
  }

  const tenant = await db
    .collection('tenants')
    .findOne({ _id: tenantId }, { projection: { subscriptionPlanId: 1, name: 1 } })

  const planRef = (subDoc?.planId as ObjectId | undefined) || ((tenant as any)?.subscriptionPlanId as ObjectId | undefined)
  const { planId, planName, entitlements: liveEntitlements } = await resolvePlanEntitlements(db, planRef)
  const usage = await countTenantUsage(db, tenantId)

  const subscription = subDoc ? serializeTenantSubscription(subDoc as any) : null
  const inTrial = subscription?.status === 'trialing'
  const trialEndsAt = subscription?.trialEndsAt || null

  // Hybrid catalog edits: expansions via live plan; reductions held via snapshot until period end.
  let entitlements = liveEntitlements

  if (subscription?.entitlementsSnapshot) {
    entitlements = mergeEntitlementsPreferHigher(subscription.entitlementsSnapshot, liveEntitlements)
  } else if (subDoc && liveEntitlements && planId) {
    // Backfill snapshot for subscriptions created before hybrid catalog edits.
    try {
      await db.collection('tenantSubscriptions').updateOne(
        { _id: subDoc._id, entitlementsSnapshot: { $exists: false } },
        {
          $set: {
            entitlementsSnapshot: liveEntitlements,
            entitlementsVersion:
              typeof (subDoc as any).entitlementsVersion === 'number'
                ? (subDoc as any).entitlementsVersion
                : 1,
            updatedAt: now
          }
        }
      )
    } catch {
      // Non-fatal — resolve still uses live entitlements
    }
  }

  let daysLeftInTrial: number | null = null

  if (inTrial && trialEndsAt) {
    daysLeftInTrial = Math.max(0, daysBetween(now, new Date(trialEndsAt)))
  }

  const usableStatuses: SubscriptionStatus[] = ['trialing', 'active', 'past_due']
  const hasUsableSub = Boolean(subscription && usableStatuses.includes(subscription.status))
  // Legacy tenants with plan FK but no subscription row still get plan entitlements
  const isUsable = hasUsableSub || Boolean(planId && !subscription)

  let reason: string | null = null

  if (!isUsable) {
    reason = subscription?.status === 'expired' ? 'subscription_expired' : 'no_active_subscription'
  }

  return {
    planId,
    planName,
    subscription,
    entitlements,
    usage,
    access: {
      isUsable,
      reason,
      inTrial,
      trialEndsAt,
      daysLeftInTrial
    }
  }
}

export type EntitlementDenial = {
  error: string
  message: string
  limit?: number
  used?: number
  feature?: string
}

export async function assertWithinLimit(
  db: Db,
  tenantId: ObjectId,
  limitKey: 'maxUsers' | 'maxCustomers' | 'maxLeads',
  options?: { bypass?: boolean }
): Promise<EntitlementDenial | null> {
  if (options?.bypass) return null

  const resolved = await resolveTenantEntitlements(db, tenantId)

  if (!resolved.access.isUsable) {
    return {
      error: 'subscription_inactive',
      message: 'Organisation subscription is inactive. Renew to continue.',
      feature: limitKey
    }
  }

  const limit = resolved.entitlements.limits[limitKey]

  if (isUnlimited(limit)) return null

  const used =
    limitKey === 'maxUsers'
      ? resolved.usage.users
      : limitKey === 'maxCustomers'
        ? resolved.usage.customers
        : resolved.usage.leads

  if (used >= limit) {
    const feature = LIMIT_FEATURES.find(f => f.key === limitKey)
    const monthly = feature?.reset === 'monthly'
    const noun =
      limitKey === 'maxUsers' ? 'seats' : limitKey === 'maxCustomers' ? 'customers' : 'leads'
    const message = monthly
      ? `This month's ${noun} limit reached (${used}/${limit}). Count resets at the start of next month.`
      : `Plan limit reached for ${noun} (${used}/${limit}).`

    return {
      error: 'limit_reached',
      message,
      limit,
      used,
      feature: limitKey
    }
  }

  return null
}

export async function assertModuleEnabled(
  db: Db,
  tenantId: ObjectId,
  moduleKey: ModuleFeatureKey,
  options?: { bypass?: boolean }
): Promise<EntitlementDenial | null> {
  if (options?.bypass) return null

  const resolved = await resolveTenantEntitlements(db, tenantId)

  if (!resolved.access.isUsable) {
    return {
      error: 'subscription_inactive',
      message: 'Organisation subscription is inactive. Renew to continue.',
      feature: moduleKey
    }
  }

  if (!resolved.entitlements.modules[moduleKey]) {
    return {
      error: 'feature_not_included',
      message: `Your plan does not include ${moduleKey}.`,
      feature: moduleKey
    }
  }

  return null
}

export function buildTrialPeriod(now = new Date(), trialDays = TRIAL_DAYS) {
  const trialStartsAt = now
  const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000)

  return {
    status: 'trialing' as const,
    trialStartsAt,
    trialEndsAt,
    currentPeriodStart: trialStartsAt,
    currentPeriodEnd: trialEndsAt
  }
}
