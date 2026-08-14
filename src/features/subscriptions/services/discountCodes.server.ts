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

function isDiscountCurrentlyValid(doc: Record<string, any>, now = new Date()): boolean {
  if (doc.isActive === false) return false

  const from = doc.validFrom instanceof Date ? doc.validFrom : new Date(doc.validFrom)
  const to = doc.validTo instanceof Date ? doc.validTo : new Date(doc.validTo)

  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime())) return false
  if (now < from || now > to) return false

  if (doc.maxRedemptions != null && Number(doc.redemptionCount || 0) >= Number(doc.maxRedemptions)) {
    return false
  }

  return true
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

  return 0
}

/**
 * Best auto-applied code for this organisation: tenant-scoped first, then plan-scoped.
 * Global promo codes are not auto-applied — those must be entered at organisation create.
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
    .find({ isActive: true, scope: { $in: ['tenant', 'plan'] } })
    .toArray()

  let best: { discount: DiscountCode; snapshot: DiscountSnapshot; objectId: ObjectId; rank: number; amount: number } | null =
    null

  for (const doc of docs) {
    if (!isDiscountCurrentlyValid(doc as any, now)) continue

    const scope = doc.scope as DiscountScope

    if (scope === 'tenant' && !idsInclude(doc.tenantIds, tenantHex)) continue
    if (scope === 'plan' && !idsInclude(doc.planIds, planHex)) continue

    const discount = serializeDiscountCode(doc as any)
    const snapshot = snapshotFromDiscount(discount)
    const amount = discountAmountForPrice(price, snapshot)
    const rank = scopeRank(scope)

    if (rank <= 0) continue

    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && amount > best.amount) ||
      (rank === best.rank && amount === best.amount && discount.createdAt > best.discount.createdAt)
    ) {
      best = { discount, snapshot, objectId: doc._id as ObjectId, rank, amount }
    }
  }

  return best ? { discount: best.discount, snapshot: best.snapshot, objectId: best.objectId } : null
}

/**
 * If the subscription has no discount yet, attach the best tenant/plan code Super Admin created for it.
 * Idempotent — existing snapshots are left in place.
 */
export async function ensureEligibleDiscountOnSubscription(params: {
  db: Db
  tenantId: ObjectId | string
  subscription: Record<string, any>
  plan: Record<string, any> | null
}): Promise<{ snapshot: DiscountSnapshot | null; discountName: string | null; attached: boolean }> {
  const { db, tenantId, subscription, plan } = params
  const existing = (subscription.discountSnapshot as DiscountSnapshot) || null

  if (existing?.code) {
    return { snapshot: existing, discountName: existing.code, attached: false }
  }

  const interval = (subscription.billingInterval === 'yearly' ? 'yearly' : 'monthly') as 'monthly' | 'yearly'
  const price = planPriceForInterval(plan, interval)
  const best = await findBestEligibleDiscount({
    db,
    tenantId,
    planId: subscription.planId || plan?._id || null,
    price
  })

  if (!best) return { snapshot: null, discountName: null, attached: false }

  const subObjectId =
    subscription._id instanceof ObjectId
      ? subscription._id
      : ObjectId.isValid(String(subscription._id || ''))
        ? new ObjectId(String(subscription._id))
        : null

  if (!subObjectId) {
    return { snapshot: best.snapshot, discountName: best.discount.name || best.discount.code, attached: false }
  }

  const now = new Date()

  const updated = await db.collection('tenantSubscriptions').updateOne(
    {
      _id: subObjectId,
      $or: [{ discountSnapshot: null }, { discountSnapshot: { $exists: false } }]
    },
    {
      $set: {
        discountCodeId: best.objectId,
        discountSnapshot: best.snapshot,
        updatedAt: now
      }
    }
  )

  if (updated.modifiedCount > 0) {
    await db.collection('discountCodes').updateOne({ _id: best.objectId }, { $inc: { redemptionCount: 1 } })

    return { snapshot: best.snapshot, discountName: best.discount.name || best.discount.code, attached: true }
  }

  const latest = await db
    .collection('tenantSubscriptions')
    .findOne({ _id: subObjectId }, { projection: { discountSnapshot: 1 } })
  const snapshot = ((latest as any)?.discountSnapshot as DiscountSnapshot) || best.snapshot

  return { snapshot, discountName: best.discount.name || snapshot?.code || null, attached: false }
}
