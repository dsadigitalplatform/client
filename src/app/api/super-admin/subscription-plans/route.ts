import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

function isValidFeatures(obj: unknown): obj is Record<string, boolean> {
  if (typeof obj !== 'object' || obj == null) return false

  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v !== 'boolean') return false
  }

  
return true
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = await getDb()

  const rawPlans = await db
    .collection('subscriptionPlans')
    .find({}, { projection: { _id: 1, name: 1, slug: 1, description: 1, priceMonthly: 1, priceYearly: 1, currency: 1, maxUsers: 1, features: 1, isActive: 1, isDefault: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray()

  const plans = rawPlans.map(p => ({ ...p, _id: String(p._id) }))

  
return NextResponse.json({ plans })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = await getDb()
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const name = isNonEmptyString(body?.name) ? body.name.trim() : ''
  const slug = isNonEmptyString(body?.slug) ? body.slug.trim().toLowerCase() : ''
  const description = isNonEmptyString(body?.description) ? body.description.trim() : ''
  const priceMonthly = isPositiveNumber(body?.priceMonthly) ? body.priceMonthly : NaN
  const priceYearlyNumber = isPositiveNumber(body?.priceYearly) ? body.priceYearly : undefined
  const currency = isNonEmptyString(body?.currency) ? body.currency.trim() : 'USD'
  const maxUsers = isPositiveInt(body?.maxUsers) ? body.maxUsers : NaN
  const features = typeof body?.features === 'object' && body?.features != null ? body.features : {}
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true
  const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : false

  if (!name || !slug || !description || Number.isNaN(priceMonthly) || Number.isNaN(maxUsers)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  if (body?.features != null && !isValidFeatures(body.features)) {
    return NextResponse.json({ error: 'invalid_features' }, { status: 400 })
  }

  const now = new Date()

  try {
    const doc: any = {
      name,
      slug,
      description,
      priceMonthly,
      currency,
      maxUsers,
      features,
      isActive,
      isDefault,
      createdAt: now,
      updatedAt: now
    }

    if (priceYearlyNumber !== undefined) doc.priceYearly = priceYearlyNumber
    const res = await db.collection('subscriptionPlans').insertOne(doc)
    const planDoc = await db.collection('subscriptionPlans').findOne({ _id: res.insertedId })
    const plan = planDoc ? { ...planDoc, _id: String(planDoc._id) } : null

    
return NextResponse.json({ plan }, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || '')
    const isDup = msg.includes('duplicate key')
    const isValidation = msg.includes('Document failed validation') || e?.code === 121

    if (isDup) return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    if (isValidation) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    
return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
