import type { Db, ObjectId as ObjectIdType } from 'mongodb'
import { ObjectId } from 'mongodb'

import type { TenantSubscriptionSummary } from '../subscription-plans.types'

const PLAN_PROJECTION = {
  _id: 1,
  name: 1,
  slug: 1,
  description: 1,
  priceMonthly: 1,
  priceYearly: 1,
  currency: 1,
  maxUsers: 1
} as const

function toHexId(value: ObjectIdType | string): string {
  if (typeof value === 'string') return value

  return typeof value.toHexString === 'function' ? value.toHexString() : String(value)
}

export function serializeSubscriptionPlan(doc: Record<string, unknown> | null | undefined): TenantSubscriptionSummary | null {
  if (!doc?._id) return null

  return {
    _id: toHexId(doc._id as ObjectIdType | string),
    name: String(doc.name || ''),
    slug: String(doc.slug || ''),
    description: String(doc.description || ''),
    priceMonthly: typeof doc.priceMonthly === 'number' ? doc.priceMonthly : 0,
    priceYearly: typeof doc.priceYearly === 'number' ? doc.priceYearly : null,
    currency: String(doc.currency || 'INR'),
    maxUsers: typeof doc.maxUsers === 'number' ? doc.maxUsers : 0
  }
}

export async function resolveSubscriptionPlan(
  db: Db,
  subscriptionPlanId: ObjectIdType | string | null | undefined
): Promise<TenantSubscriptionSummary | null> {
  if (!subscriptionPlanId) return null

  const id = toHexId(subscriptionPlanId)

  if (!ObjectId.isValid(id)) return null

  const doc = (await db
    .collection('subscriptionPlans')
    .findOne({ _id: new ObjectId(id) }, { projection: PLAN_PROJECTION })) as Record<string, unknown> | null

  return serializeSubscriptionPlan(doc)
}

export async function resolveSubscriptionPlansByIds(
  db: Db,
  planIds: Array<ObjectIdType | string | null | undefined>
): Promise<Map<string, TenantSubscriptionSummary>> {
  const unique = new Map<string, ObjectId>()

  for (const raw of planIds) {
    if (!raw) continue
    const id = toHexId(raw)

    if (ObjectId.isValid(id) && !unique.has(id)) unique.set(id, new ObjectId(id))
  }

  const result = new Map<string, TenantSubscriptionSummary>()

  if (unique.size === 0) return result

  const docs = await db
    .collection('subscriptionPlans')
    .find({ _id: { $in: Array.from(unique.values()) } }, { projection: PLAN_PROJECTION })
    .toArray()

  for (const doc of docs) {
    const plan = serializeSubscriptionPlan(doc as Record<string, unknown>)

    if (plan) result.set(plan._id, plan)
  }

  return result
}
