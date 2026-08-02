import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { normalizePlanEntitlements } from '@features/subscription-plans/featureCatalog'
import {
  buildCatalogEditMessages,
  classifyCatalogEntitlementChange,
  type CatalogEditImpact
} from '@features/subscription-plans/planCatalogEditPolicy'
import { countActiveSubscribersOnPlan } from '@features/subscription-plans/services/planCatalogEdit.server'
import { parseEntitlementsFromBody } from '@features/subscription-plans/services/planSerialization'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

/**
 * Preview how a proposed plan edit would affect existing subscribers.
 * POST body may include entitlements + price fields to classify impact.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  const db = await getDb()
  let existing: any = null

  if (ObjectId.isValid(idParam)) {
    existing = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(idParam) })
  }

  if (!existing) {
    existing = await db.collection('subscriptionPlans').findOne({ _id: idParam as any })
  }

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let body: any = {}

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const previous = normalizePlanEntitlements(existing.entitlements || existing, existing.maxUsers)
  const next =
    body?.entitlements != null || body?.maxUsers != null
      ? parseEntitlementsFromBody(body, typeof body?.maxUsers === 'number' ? body.maxUsers : undefined)
      : previous

  const { expands, shrinks } = classifyCatalogEntitlementChange(previous, next)

  const priceChanged =
    (body?.priceMonthly != null && Number(body.priceMonthly) !== Number(existing.priceMonthly)) ||
    (body?.priceYearly != null && Number(body.priceYearly) !== Number(existing.priceYearly ?? NaN))

  const activeSubscriberCount = await countActiveSubscribersOnPlan(db, String(existing._id))

  const impact: CatalogEditImpact = {
    expands,
    shrinks,
    priceChanged,
    activeSubscriberCount
  }

  return NextResponse.json({
    impact,
    messages: buildCatalogEditMessages(impact)
  })
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  const db = await getDb()
  const activeSubscriberCount = await countActiveSubscribersOnPlan(db, idParam)

  return NextResponse.json({ activeSubscriberCount })
}
