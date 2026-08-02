export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveSubscriptionPlansByIds } from '@features/subscription-plans/services/resolveSubscriptionPlan.server'

/**
 * Super Admin tenant directory.
 * ?lite=1 returns {_id, name} only (for discount code pickers).
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const lite = searchParams.get('lite') === '1' || searchParams.get('lite') === 'true'
  const q = (searchParams.get('q') || '').trim().toLowerCase()

  const db = await getDb()
  const filter: Record<string, unknown> = {}

  if (q) {
    filter.name = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  }

  if (lite) {
    const docs = await db
      .collection('tenants')
      .find(filter, { projection: { _id: 1, name: 1 } })
      .sort({ name: 1 })
      .limit(500)
      .toArray()

    return NextResponse.json({
      tenants: docs.map(t => ({ _id: String(t._id), name: String(t.name || '') }))
    })
  }

  const docs = await db
    .collection('tenants')
    .find(filter, {
      projection: {
        _id: 1,
        name: 1,
        type: 1,
        status: 1,
        subscriptionPlanId: 1,
        createdAt: 1,
        updatedAt: 1
      }
    })
    .sort({ updatedAt: -1 })
    .limit(500)
    .toArray()

  const planIds = docs.map(t => (t as any).subscriptionPlanId).filter(Boolean)
  const plansById = await resolveSubscriptionPlansByIds(db, planIds)

  const tenantIds = docs.map(t => t._id as ObjectId)
  const subs =
    tenantIds.length > 0
      ? await db
          .collection('tenantSubscriptions')
          .find(
            { tenantId: { $in: tenantIds }, status: { $in: ['trialing', 'active', 'past_due'] } },
            {
              projection: {
                tenantId: 1,
                status: 1,
                currentPeriodEnd: 1,
                trialEndsAt: 1,
                cancelAtPeriodEnd: 1,
                lastPaymentStatus: 1,
                lastPaymentMethod: 1,
                lastPaymentAt: 1,
                planId: 1,
                billingInterval: 1
              }
            }
          )
          .toArray()
      : []

  const subByTenant = new Map<string, (typeof subs)[0]>()

  for (const s of subs) {
    const tid = String(s.tenantId)

    if (!subByTenant.has(tid)) subByTenant.set(tid, s)
  }

  const tenants = docs.map(t => {
    const id = String(t._id)
    const planId = (t as any).subscriptionPlanId ? String((t as any).subscriptionPlanId) : null
    const plan = planId ? plansById.get(planId) ?? null : null
    const sub = subByTenant.get(id)

    return {
      _id: id,
      name: String(t.name || ''),
      type: t.type || null,
      status: t.status || 'active',
      subscriptionPlanId: planId,
      subscriptionPlan: plan,
      subscription: sub
        ? {
            status: sub.status,
            planId: sub.planId ? String(sub.planId) : null,
            billingInterval: sub.billingInterval || 'monthly',
            currentPeriodEnd:
              sub.currentPeriodEnd instanceof Date
                ? sub.currentPeriodEnd.toISOString()
                : sub.currentPeriodEnd
                  ? new Date(sub.currentPeriodEnd).toISOString()
                  : null,
            trialEndsAt:
              sub.trialEndsAt instanceof Date
                ? sub.trialEndsAt.toISOString()
                : sub.trialEndsAt
                  ? new Date(sub.trialEndsAt).toISOString()
                  : null,
            cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
            lastPaymentStatus: sub.lastPaymentStatus || 'none',
            lastPaymentMethod: sub.lastPaymentMethod || null,
            lastPaymentAt:
              sub.lastPaymentAt instanceof Date
                ? sub.lastPaymentAt.toISOString()
                : sub.lastPaymentAt
                  ? new Date(sub.lastPaymentAt).toISOString()
                  : null
          }
        : null,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt
    }
  })

  return NextResponse.json({ tenants })
}
