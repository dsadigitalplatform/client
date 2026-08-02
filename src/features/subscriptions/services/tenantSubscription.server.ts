import 'server-only'

import type { Db, ObjectId as ObjectIdType } from 'mongodb'
import { ObjectId } from 'mongodb'

import { TRIAL_DAYS } from '@features/subscription-plans/featureCatalog'
import { entitlementsSnapshotFromPlanDoc } from '@features/subscription-plans/services/planCatalogEdit.server'

import type { BillingInterval, DiscountSnapshot, RenewalMode } from '../subscriptions.types'
import { buildTrialPeriod, serializeTenantSubscription } from './entitlements.server'

export async function createTenantSubscription(params: {
  db: Db
  tenantId: ObjectIdType
  planId: ObjectIdType
  ownerUserId: ObjectIdType
  billingInterval?: BillingInterval
  renewalMode?: RenewalMode
  discountCodeId?: ObjectIdType | null
  discountSnapshot?: DiscountSnapshot | null
  trialEnabled?: boolean
  trialDays?: number
}) {
  const {
    db,
    tenantId,
    planId,
    ownerUserId,
    billingInterval = 'monthly',
    renewalMode = 'manual',
    discountCodeId = null,
    discountSnapshot = null,
    trialEnabled = true,
    trialDays = TRIAL_DAYS
  } = params

  const now = new Date()
  const useTrial = trialEnabled && trialDays > 0

  let status: 'trialing' | 'active' = useTrial ? 'trialing' : 'active'
  let trialStartsAt: Date | null = null
  let trialEndsAt: Date | null = null
  let currentPeriodStart = now
  let currentPeriodEnd: Date

  if (useTrial) {
    const trial = buildTrialPeriod(now, trialDays)

    status = trial.status
    trialStartsAt = trial.trialStartsAt
    trialEndsAt = trial.trialEndsAt
    currentPeriodStart = trial.currentPeriodStart
    currentPeriodEnd = trial.currentPeriodEnd
  } else {
    const days = billingInterval === 'yearly' ? 365 : 30

    currentPeriodEnd = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)
  }

  // Expire any previous active/trialing rows for this tenant
  await db.collection('tenantSubscriptions').updateMany(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { $set: { status: 'canceled', canceledAt: now, updatedAt: now } }
  )

  const planDoc = await db.collection('subscriptionPlans').findOne({ _id: planId })
  const snap = entitlementsSnapshotFromPlanDoc(planDoc as any)

  const doc = {
    tenantId,
    planId,
    status,
    billingInterval,
    renewalMode,
    trialStartsAt,
    trialEndsAt,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    pendingPlanId: null,
    pendingBillingInterval: null,
    pendingChangeEffectiveAt: null,
    pendingChangeKind: null,
    entitlementsSnapshot: snap?.entitlementsSnapshot ?? null,
    entitlementsVersion: snap?.entitlementsVersion ?? null,
    billingContactUserId: ownerUserId,
    billingContactNominatedBy: null,
    discountCodeId,
    discountSnapshot,
    paymentProvider: null,
    externalCustomerId: null,
    externalSubscriptionId: null,
    externalPlanId: null,
    externalSubscriptionStatus: null,
    defaultPaymentMethodLabel: null,
    lastPaymentStatus: 'none' as const,
    lastPaymentMethod: null,
    lastPaymentNote: null,
    lastPaymentAt: null,
    lastPaymentRecordedBy: null,
    reminderDaysBeforeDue: [7, 3, 1],
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('tenantSubscriptions').insertOne(doc)

  await db.collection('tenants').updateOne(
    { _id: tenantId },
    { $set: { subscriptionPlanId: planId, updatedAt: now } }
  )

  return serializeTenantSubscription({ ...doc, _id: res.insertedId })
}

/** @deprecated use createTenantSubscription */
export async function createTenantTrialSubscription(
  params: Parameters<typeof createTenantSubscription>[0]
) {
  return createTenantSubscription({ ...params, trialEnabled: params.trialEnabled !== false })
}

export async function updateTenantSubscriptionBilling(params: {
  db: Db
  tenantId: ObjectIdType
  actorUserId: ObjectIdType
  renewalMode?: RenewalMode
  billingContactUserId?: ObjectIdType
  billingInterval?: BillingInterval
}) {
  const { db, tenantId, actorUserId, renewalMode, billingContactUserId, billingInterval } = params
  const now = new Date()

  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId, status: { $in: ['trialing', 'active', 'past_due'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) return null

  const update: Record<string, unknown> = { updatedAt: now }

  if (renewalMode === 'auto' || renewalMode === 'manual') update.renewalMode = renewalMode
  if (billingInterval === 'monthly' || billingInterval === 'yearly') update.billingInterval = billingInterval

  if (billingContactUserId) {
    update.billingContactUserId = billingContactUserId
    update.billingContactNominatedBy = actorUserId.equals(billingContactUserId) ? null : actorUserId
  }

  await db.collection('tenantSubscriptions').updateOne({ _id: sub._id }, { $set: update })

  const updated = await db.collection('tenantSubscriptions').findOne({ _id: sub._id })

  return updated ? serializeTenantSubscription(updated as any) : null
}

export async function ensureSubscriptionBillingReminders(params: {
  db: Db
  tenantId: ObjectIdType
  subscriptionId: ObjectIdType
  billingContactUserId: ObjectIdType
  periodEnd: Date
  renewalMode: RenewalMode
  reminderDaysBeforeDue: number[]
}) {
  const { db, tenantId, subscriptionId, billingContactUserId, periodEnd, renewalMode, reminderDaysBeforeDue } = params

  if (renewalMode !== 'manual') {
    // Clear pending billing reminders when switching to auto (provider will handle later)
    await db.collection('reminders').deleteMany({
      tenantId,
      source: 'SUBSCRIPTION_BILLING',
      status: 'pending',
      subscriptionId
    })

    return
  }

  const now = new Date()
  const days = reminderDaysBeforeDue.length > 0 ? reminderDaysBeforeDue : [7, 3, 1]

  for (const day of days) {
    const reminderDateTime = new Date(periodEnd.getTime() - day * 24 * 60 * 60 * 1000)

    if (reminderDateTime.getTime() <= now.getTime()) continue

    const existing = await db.collection('reminders').findOne({
      tenantId,
      userId: billingContactUserId,
      source: 'SUBSCRIPTION_BILLING',
      subscriptionId,
      status: 'pending',
      reminderDayOffset: day
    })

    const title = day === 1 ? 'Subscription due tomorrow' : `Subscription due in ${day} days`
    const description = 'Manual renewal is required for your organisation subscription.'

    if (existing?._id) {
      await db.collection('reminders').updateOne(
        { _id: existing._id },
        { $set: { title, description, reminderDateTime, updatedAt: now } }
      )
      continue
    }

    await db.collection('reminders').insertOne({
      tenantId,
      userId: billingContactUserId,
      source: 'SUBSCRIPTION_BILLING',
      status: 'pending',
      title,
      description,
      reminderDateTime,
      reminderDayOffset: day,
      subscriptionId,
      caseId: null,
      appointmentId: null,
      customerId: null,
      caseRef: null,
      createdAt: now,
      updatedAt: now
    })
  }
}
