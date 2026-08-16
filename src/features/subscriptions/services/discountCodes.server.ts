import 'server-only'

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

import type { DiscountCode, DiscountDuration, DiscountScope, DiscountSnapshot, DiscountType } from '../subscriptions.types'
import { discountAmountForPrice, planPriceForInterval } from './discountPricing'

function toIso(d: unknown): string {
  const date = d instanceof Date ? d : new Date(String(d))

  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date(0).toISOString()
}

export function serializeDiscountCode(doc: Record<string, any>): DiscountCode {
  return {
    _id: String(doc._id),
    code: String(doc.code || '').toUpperCase(),
    name: String(doc.name || ''),
    description: String(doc.description || ''),
    type: doc.type as DiscountType,
    value: Number(doc.value || 0),
    currency: doc.currency ? String(doc.currency) : null,
    scope: doc.scope as DiscountScope,
    planIds: Array.isArray(doc.planIds) ? doc.planIds.map((id: any) => String(id)) : [],
    tenantIds: Array.isArray(doc.tenantIds) ? doc.tenantIds.map((id: any) => String(id)) : [],
    validFrom: toIso(doc.validFrom),
    validTo: toIso(doc.validTo),
    maxRedemptions: doc.maxRedemptions == null ? null : Number(doc.maxRedemptions),
    redemptionCount: Number(doc.redemptionCount || 0),
    duration: (doc.duration || 'once') as DiscountDuration,
    durationMonths: doc.durationMonths == null ? null : Number(doc.durationMonths),
    isActive: doc.isActive !== false,
    createdBy: String(doc.createdBy || ''),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt)
  }
}

export async function findApplicableDiscount(params: {
  db: Db
  code: string
  tenantId?: ObjectId | string | null
  planId?: ObjectId | string | null
}): Promise<{ discount: DiscountCode; snapshot: DiscountSnapshot } | { error: string } | null> {
  const { db, code, tenantId, planId } = params
  const normalized = code.trim().toUpperCase()

  if (!normalized) return null

  const doc = await db.collection('discountCodes').findOne({ code: normalized, isActive: true })

  if (!doc) return { error: 'discount_not_found' }

  const now = new Date()
  const from = doc.validFrom instanceof Date ? doc.validFrom : new Date(doc.validFrom)
  const to = doc.validTo instanceof Date ? doc.validTo : new Date(doc.validTo)

  if (now < from || now > to) return { error: 'discount_expired' }

  if (doc.maxRedemptions != null && Number(doc.redemptionCount || 0) >= Number(doc.maxRedemptions)) {
    return { error: 'discount_exhausted' }
  }

  const scope = doc.scope as DiscountScope
  const tenantHex = tenantId ? (typeof tenantId === 'string' ? tenantId : tenantId.toHexString()) : null
  const planHex = planId ? (typeof planId === 'string' ? planId : planId.toHexString()) : null

  if (scope === 'tenant') {
    const allowed = (doc.tenantIds || []).map((id: any) => String(id))

    if (!tenantHex || !allowed.includes(tenantHex)) return { error: 'discount_not_applicable' }
  }

  if (scope === 'plan') {
    const allowed = (doc.planIds || []).map((id: any) => String(id))

    if (!planHex || !allowed.includes(planHex)) return { error: 'discount_not_applicable' }
  }

  const discount = serializeDiscountCode(doc)

  return { discount, snapshot: snapshotFromDiscount(discount) }
}

function idsInclude(ids: unknown, match: string | null): boolean {
  if (!match || !Array.isArray(ids)) return false

  return ids.some(id => String(id) === match)
}

function isDiscountWithinValidityWindow(doc: Record<string, any>, now = new Date()): boolean {
  const from = doc.validFrom instanceof Date ? doc.validFrom : new Date(doc.validFrom)
  const to = doc.validTo instanceof Date ? doc.validTo : new Date(doc.validTo)

  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return false
  if (now < from || now > to) return false

  return true
}

function isDiscountCurrentlyValid(doc: Record<string, any>, now = new Date()): boolean {
  if (doc.isActive === false) return false
  if (!isDiscountWithinValidityWindow(doc, now)) return false

  if (doc.maxRedemptions != null && Number(doc.redemptionCount || 0) >= Number(doc.maxRedemptions)) {
    return false
  }

  return true
}

function discountAppliesToTenantPlan(
  doc: Record<string, any>,
  tenantHex: string | null,
  planHex: string | null
): boolean {
  const scope = doc.scope as DiscountScope

  if (scope === 'global') return true
  if (scope === 'tenant') return idsInclude(doc.tenantIds, tenantHex)
  if (scope === 'plan') return idsInclude(doc.planIds, planHex)

  return false
}

/** Already-attached codes stay until they are deactivated, expire, or no longer apply. */
function isAttachedDiscountStillHonored(
  doc: Record<string, any>,
  tenantHex: string | null,
  planHex: string | null,
  now = new Date()
): boolean {
  if (doc.isActive === false) return false
  if (!isDiscountWithinValidityWindow(doc, now)) return false

  return discountAppliesToTenantPlan(doc, tenantHex, planHex)
}

function snapshotFromDiscount(discount: DiscountCode): DiscountSnapshot {
  return {
    code: discount.code,
    type: discount.type,
    value: discount.value,
    currency: discount.currency,
    duration: discount.duration,
    durationMonths: discount.durationMonths
  }
}

function scopeRank(scope: DiscountScope): number {
  if (scope === 'tenant') return 3
  if (scope === 'plan') return 2
  if (scope === 'global') return 1

  return 0
}

function isBetterCandidate(
  candidate: { rank: number; amount: number; createdAt: string },
  current: { rank: number; amount: number; createdAt: string }
): boolean {
  if (candidate.amount !== current.amount) return candidate.amount > current.amount
  if (candidate.rank !== current.rank) return candidate.rank > current.rank

  return candidate.createdAt > current.createdAt
}

/**
 * Best auto-applied code for this organisation: largest saving wins.
 * Ties prefer tenant-scoped, then plan-scoped, then global (all orgs & plans).
 */
export async function findBestEligibleDiscount(params: {
  db: Db
  tenantId?: ObjectId | string | null
  planId?: ObjectId | string | null
  price: number
}): Promise<{ discount: DiscountCode; snapshot: DiscountSnapshot; objectId: ObjectId } | null> {
  const { db, price } = params
  const tenantHex = params.tenantId ? String(params.tenantId) : null
  const planHex = params.planId ? String(params.planId) : null
  const now = new Date()

  const docs = await db
    .collection('discountCodes')
    .find({ isActive: true, scope: { $in: ['global', 'tenant', 'plan'] } })
    .toArray()

  let best: { discount: DiscountCode; snapshot: DiscountSnapshot; objectId: ObjectId; rank: number; amount: number } | null =
    null

  for (const doc of docs) {
    if (!isDiscountCurrentlyValid(doc as any, now)) continue

    const scope = doc.scope as DiscountScope
    const rank = scopeRank(scope)

    if (rank <= 0) continue
    if (scope === 'tenant' && !idsInclude(doc.tenantIds, tenantHex)) continue
    if (scope === 'plan' && !idsInclude(doc.planIds, planHex)) continue

    const discount = serializeDiscountCode(doc as any)
    const snapshot = snapshotFromDiscount(discount)
    const amount = discountAmountForPrice(price, snapshot)
    const candidate = { discount, snapshot, objectId: doc._id as ObjectId, rank, amount }

    if (
      !best ||
      isBetterCandidate(
        { rank, amount, createdAt: discount.createdAt },
        { rank: best.rank, amount: best.amount, createdAt: best.discount.createdAt }
      )
    ) {
      best = candidate
    }
  }

  return best ? { discount: best.discount, snapshot: best.snapshot, objectId: best.objectId } : null
}

type DiscountAttachment = {
  discount: DiscountCode
  snapshot: DiscountSnapshot
  objectId: ObjectId
}

function attachmentFromDoc(doc: Record<string, any>): DiscountAttachment {
  const discount = serializeDiscountCode(doc)

  return { discount, snapshot: snapshotFromDiscount(discount), objectId: doc._id as ObjectId }
}

async function loadLiveDiscountForSubscription(
  db: Db,
  subscription: Record<string, any>
): Promise<Record<string, any> | null> {
  const id = subscription.discountCodeId

  if (id && ObjectId.isValid(String(id))) {
    const byId = await db.collection('discountCodes').findOne({ _id: new ObjectId(String(id)) })

    if (byId) return byId as Record<string, any>
  }

  const code = String((subscription.discountSnapshot as DiscountSnapshot | null)?.code || '')
    .trim()
    .toUpperCase()

  if (!code) return null

  return (await db.collection('discountCodes').findOne({ code })) as Record<string, any> | null
}

function sameAttachment(subscription: Record<string, any>, desired: DiscountAttachment | null): boolean {
  const currentCode = String((subscription.discountSnapshot as DiscountSnapshot | null)?.code || '')
    .trim()
    .toUpperCase()
  const nextCode = desired?.snapshot.code || ''
  const currentId = subscription.discountCodeId ? String(subscription.discountCodeId) : ''
  const nextId = desired?.objectId ? String(desired.objectId) : ''

  if (!currentCode && !nextCode) return true
  if (currentCode !== nextCode) return false
  if (currentId && nextId) return currentId === nextId

  return true
}

function applyAttachmentToSubscription(subscription: Record<string, any>, desired: DiscountAttachment | null) {
  subscription.discountSnapshot = desired?.snapshot || null
  subscription.discountCodeId = desired
    ? typeof subscription._id === 'string' || typeof subscription.discountCodeId === 'string'
      ? String(desired.objectId)
      : desired.objectId
    : null
}

function resolveSubObjectId(subscription: Record<string, any>): ObjectId | null {
  if (subscription._id instanceof ObjectId) return subscription._id
  if (ObjectId.isValid(String(subscription._id || ''))) return new ObjectId(String(subscription._id))

  return null
}

/**
 * Keep the current code only while it is still active and in window; otherwise attach the
 * best remaining live code (global, plan, or tenant). A more valuable live code replaces the current one.
 */
export async function ensureEligibleDiscountOnSubscription(params: {
  db: Db
  tenantId: ObjectId | string
  subscription: Record<string, any>
  plan: Record<string, any> | null
}): Promise<{ snapshot: DiscountSnapshot | null; discountName: string | null; attached: boolean }> {
  const { db, tenantId, subscription, plan } = params
  const tenantHex = tenantId ? String(tenantId) : null
  const planHex = subscription.planId || plan?._id ? String(subscription.planId || plan?._id) : null
  const interval = (subscription.billingInterval === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly'
  const price = planPriceForInterval(plan, interval)
  const now = new Date()

  const [best, live] = await Promise.all([
    findBestEligibleDiscount({
      db,
      tenantId,
      planId: subscription.planId || plan?._id || null,
      price
    }),
    loadLiveDiscountForSubscription(db, subscription)
  ])

  const currentHonored = live ? isAttachedDiscountStillHonored(live, tenantHex, planHex, now) : false
  let desired: DiscountAttachment | null = null

  if (currentHonored && live) {
    const attached = attachmentFromDoc(live)

    if (best && String(best.objectId) === String(attached.objectId)) {
      desired = best
    } else if (
      best &&
      isBetterCandidate(
        {
          rank: scopeRank(best.discount.scope),
          amount: discountAmountForPrice(price, best.snapshot),
          createdAt: best.discount.createdAt
        },
        {
          rank: scopeRank(attached.discount.scope),
          amount: discountAmountForPrice(price, attached.snapshot),
          createdAt: attached.discount.createdAt
        }
      )
    ) {
      desired = best
    } else {
      desired = attached
    }
  } else {
    desired = best
  }

  if (sameAttachment(subscription, desired)) {
    applyAttachmentToSubscription(subscription, desired)

    return {
      snapshot: desired?.snapshot || null,
      discountName: desired?.discount.name || desired?.discount.code || null,
      attached: false
    }
  }

  const subObjectId = resolveSubObjectId(subscription)

  if (!subObjectId) {
    applyAttachmentToSubscription(subscription, desired)

    return {
      snapshot: desired?.snapshot || null,
      discountName: desired?.discount.name || desired?.discount.code || null,
      attached: false
    }
  }

  const previousId = subscription.discountCodeId ? String(subscription.discountCodeId) : ''
  const nextId = desired ? String(desired.objectId) : ''

  await db.collection('tenantSubscriptions').updateOne(
    { _id: subObjectId },
    {
      $set: {
        discountCodeId: desired?.objectId || null,
        discountSnapshot: desired?.snapshot || null,
        updatedAt: now
      }
    }
  )

  if (desired && nextId !== previousId) {
    await db.collection('discountCodes').updateOne({ _id: desired.objectId }, { $inc: { redemptionCount: 1 } })
  }

  applyAttachmentToSubscription(subscription, desired)

  return {
    snapshot: desired?.snapshot || null,
    discountName: desired?.discount.name || desired?.discount.code || null,
    attached: Boolean(desired)
  }
}

const LIVE_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due']

async function ensureBestDiscountOnSubscriptions(db: Db, subs: Record<string, any>[]): Promise<void> {
  if (!subs.length) return

  const planIds = [
    ...new Set(subs.map(sub => (sub.planId ? String(sub.planId) : '')).filter(id => id && ObjectId.isValid(id)))
  ].map(id => new ObjectId(id))

  const plans = planIds.length
    ? await db.collection('subscriptionPlans').find({ _id: { $in: planIds } }).toArray()
    : []
  const planById = new Map(plans.map(plan => [String(plan._id), plan]))

  for (const sub of subs) {
    await ensureEligibleDiscountOnSubscription({
      db,
      tenantId: sub.tenantId,
      subscription: sub,
      plan: (planById.get(String(sub.planId)) as Record<string, any> | undefined) || null
    })
  }
}

/** After a code is deactivated or deleted, drop it from subscriptions and apply the next-best live code. */
export async function reapplyBestDiscountsForCode(params: {
  db: Db
  discountCodeId: ObjectId
  code?: string | null
}): Promise<void> {
  const { db, discountCodeId, code } = params
  const or: Record<string, unknown>[] = [{ discountCodeId }, { discountCodeId: discountCodeId.toHexString() }]
  const normalized = String(code || '')
    .trim()
    .toUpperCase()

  if (normalized) or.push({ 'discountSnapshot.code': normalized })

  const subs = await db.collection('tenantSubscriptions').find({ $or: or }).toArray()

  await ensureBestDiscountOnSubscriptions(db, subs as Record<string, any>[])
}

/** Attach the best live code to matching organisations when Super Admin creates a promo. */
export async function applyBestDiscountsToEligibleSubscriptions(params: {
  db: Db
  scope: DiscountScope
  planIds?: ObjectId[]
  tenantIds?: ObjectId[]
}): Promise<void> {
  const { db, scope, planIds, tenantIds } = params
  const filter: Record<string, unknown> = { status: { $in: LIVE_SUBSCRIPTION_STATUSES } }

  if (scope === 'plan') {
    if (!planIds?.length) return
    filter.planId = { $in: planIds }
  } else if (scope === 'tenant') {
    if (!tenantIds?.length) return
    filter.tenantId = { $in: tenantIds }
  } else if (scope !== 'global') {
    return
  }

  const subs = await db.collection('tenantSubscriptions').find(filter).toArray()

  await ensureBestDiscountOnSubscriptions(db, subs as Record<string, any>[])
}

/** After selected codes are deleted from the master, drop them from orgs and apply the next-best live code. */
export async function afterDiscountCodesRemoved(params: {
  db: Db
  discountCodeIds: ObjectId[]
  codes?: string[]
}): Promise<void> {
  const { db, discountCodeIds, codes } = params
  const or: Record<string, unknown>[] = []

  if (discountCodeIds.length > 0) {
    or.push({ discountCodeId: { $in: discountCodeIds } })
    or.push({ discountCodeId: { $in: discountCodeIds.map(id => id.toHexString()) } })
  }

  const normalized = (codes || []).map(c => String(c || '').trim().toUpperCase()).filter(Boolean)

  if (normalized.length > 0) or.push({ 'discountSnapshot.code': { $in: normalized } })
  if (or.length === 0) return

  const subs = await db.collection('tenantSubscriptions').find({ $or: or }).toArray()

  await ensureBestDiscountOnSubscriptions(db, subs as Record<string, any>[])
}

/** After the discount-code master is emptied, strip applied discounts from every subscription. */
export async function afterAllDiscountCodesCleared(db: Db): Promise<void> {
  await db.collection('tenantSubscriptions').updateMany(
    {
      $or: [{ discountCodeId: { $ne: null } }, { discountSnapshot: { $ne: null } }]
    },
    { $set: { discountCodeId: null, discountSnapshot: null, updatedAt: new Date() } }
  )
}
