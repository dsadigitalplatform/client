import 'server-only'

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

import type { DiscountCode, DiscountDuration, DiscountScope, DiscountSnapshot, DiscountType } from '../subscriptions.types'

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
  const snapshot: DiscountSnapshot = {
    code: discount.code,
    type: discount.type,
    value: discount.value,
    currency: discount.currency,
    duration: discount.duration,
    durationMonths: discount.durationMonths
  }

  return { discount, snapshot }
}
