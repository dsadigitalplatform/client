export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { isSupportedCurrency, normalizeCurrency } from '@features/subscription-plans/currencies'
import { serializeDiscountCode } from '@features/subscriptions/services/discountCodes.server'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const db = await getDb()
  const docs = await db.collection('discountCodes').find({}).sort({ createdAt: -1 }).toArray()

  return NextResponse.json({ discounts: docs.map(d => serializeDiscountCode(d as any)) })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const code = isNonEmptyString(body?.code) ? body.code.trim().toUpperCase() : ''
  const name = isNonEmptyString(body?.name) ? body.name.trim() : ''
  const description = isNonEmptyString(body?.description) ? body.description.trim() : ''
  const type = body?.type === 'percent' || body?.type === 'fixed' ? body.type : null
  const value = typeof body?.value === 'number' && Number.isFinite(body.value) && body.value > 0 ? body.value : NaN
  const scope = body?.scope === 'global' || body?.scope === 'plan' || body?.scope === 'tenant' ? body.scope : null
  const duration =
    body?.duration === 'once' || body?.duration === 'repeating' || body?.duration === 'forever' ? body.duration : 'once'
  const validFrom = body?.validFrom ? new Date(body.validFrom) : new Date()
  const validTo = body?.validTo ? new Date(body.validTo) : null

  if (!code || !name || !type || Number.isNaN(value) || !scope || !validTo || !Number.isFinite(validTo.getTime())) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  if (type === 'percent' && (value < 1 || value > 100)) {
    return NextResponse.json({ error: 'invalid_percent' }, { status: 400 })
  }

  let currency: string | null = null

  if (type === 'fixed') {
    const raw = isNonEmptyString(body?.currency) ? body.currency : 'INR'

    if (!isSupportedCurrency(raw)) return NextResponse.json({ error: 'invalid_currency' }, { status: 400 })
    currency = normalizeCurrency(raw)
  }

  const planIds = Array.isArray(body?.planIds)
    ? body.planIds.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id))
    : []
  const tenantIds = Array.isArray(body?.tenantIds)
    ? body.tenantIds.filter((id: string) => ObjectId.isValid(id)).map((id: string) => new ObjectId(id))
    : []

  if (scope === 'plan' && planIds.length === 0) {
    return NextResponse.json({ error: 'plan_ids_required' }, { status: 400 })
  }

  if (scope === 'tenant' && tenantIds.length === 0) {
    return NextResponse.json({ error: 'tenant_ids_required' }, { status: 400 })
  }

  const now = new Date()
  const db = await getDb()

  try {
    const doc = {
      code,
      name,
      description,
      type,
      value,
      currency,
      scope,
      planIds,
      tenantIds,
      validFrom,
      validTo,
      maxRedemptions: typeof body?.maxRedemptions === 'number' ? Math.trunc(body.maxRedemptions) : null,
      redemptionCount: 0,
      duration,
      durationMonths:
        duration === 'repeating' && typeof body?.durationMonths === 'number' ? Math.trunc(body.durationMonths) : null,
      isActive: body?.isActive !== false,
      createdBy: new ObjectId(session.userId),
      createdAt: now,
      updatedAt: now
    }

    const res = await db.collection('discountCodes').insertOne(doc)
    const saved = await db.collection('discountCodes').findOne({ _id: res.insertedId })

    return NextResponse.json({ discount: serializeDiscountCode(saved as any) }, { status: 201 })
  } catch (e: any) {
    if (String(e?.message || '').includes('duplicate key')) {
      return NextResponse.json({ error: 'duplicate_code' }, { status: 409 })
    }

    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
