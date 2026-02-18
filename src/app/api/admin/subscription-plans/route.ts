import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { ObjectId } from 'mongodb'

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

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = await getDb()

  const plans = await db
    .collection('subscriptionPlans')
    .find({}, { projection: { _id: 1, name: 1, slug: 1, description: 1, priceMonthly: 1, priceYearly: 1, currency: 1, maxUsers: 1, features: 1, isActive: 1, isDefault: 1, createdAt: 1, updatedAt: 1 } })
    .sort({ createdAt: -1 })
    .toArray()

  
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
  const priceYearly = body?.priceYearly == null ? null : (isPositiveNumber(body?.priceYearly) ? body.priceYearly : NaN)
  const currency = isNonEmptyString(body?.currency) ? body.currency.trim() : 'USD'
  const maxUsers = isPositiveInt(body?.maxUsers) ? body.maxUsers : NaN
  const features = typeof body?.features === 'object' && body?.features != null ? body.features : {}
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true
  const isDefault = typeof body?.isDefault === 'boolean' ? body.isDefault : false

  if (!name || !slug || !description || Number.isNaN(priceMonthly) || Number.isNaN(maxUsers)) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const now = new Date()

  try {
    const res = await db.collection('subscriptionPlans').insertOne({
      name,
      slug,
      description,
      priceMonthly,
      priceYearly,
      currency,
      maxUsers,
      features,
      isActive,
      isDefault,
      createdAt: now,
      updatedAt: now
    })

    const plan = await db.collection('subscriptionPlans').findOne({ _id: res.insertedId })

    
return NextResponse.json({ plan }, { status: 201 })
  } catch (e: any) {
    const msg = String(e?.message || '')
    const isDup = msg.includes('duplicate key')

    
return NextResponse.json({ error: isDup ? 'duplicate' : 'internal_error' }, { status: isDup ? 409 : 500 })
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = await getDb()
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = isNonEmptyString(body?.id) && ObjectId.isValid(body.id) ? new ObjectId(body.id) : null

  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const update: any = { updatedAt: new Date() }

  if (isNonEmptyString(body?.name)) update.name = body.name.trim()
  if (isNonEmptyString(body?.slug)) update.slug = body.slug.trim().toLowerCase()
  if (isNonEmptyString(body?.description)) update.description = body.description.trim()

  if (body?.priceMonthly != null) {
    if (!isPositiveNumber(body.priceMonthly)) return NextResponse.json({ error: 'invalid_priceMonthly' }, { status: 400 })
    update.priceMonthly = body.priceMonthly
  }

  if (body?.priceYearly != null) {
    if (!isPositiveNumber(body.priceYearly)) return NextResponse.json({ error: 'invalid_priceYearly' }, { status: 400 })
    update.priceYearly = body.priceYearly
  }

  if (isNonEmptyString(body?.currency)) update.currency = body.currency.trim()

  if (body?.maxUsers != null) {
    if (!isPositiveInt(body.maxUsers)) return NextResponse.json({ error: 'invalid_maxUsers' }, { status: 400 })
    update.maxUsers = body.maxUsers
  }

  if (typeof body?.features === 'object' && body.features != null) update.features = body.features
  if (typeof body?.isActive === 'boolean') update.isActive = body.isActive
  if (typeof body?.isDefault === 'boolean') update.isDefault = body.isDefault

  try {
    const res = await db.collection('subscriptionPlans').findOneAndUpdate({ _id: id }, { $set: update }, { returnDocument: 'after' })

    if (!res?.value) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    
return NextResponse.json({ plan: res!.value })
  } catch (e: any) {
    const msg = String(e?.message || '')
    const isDup = msg.includes('duplicate key')

    
return NextResponse.json({ error: isDup ? 'duplicate' : 'internal_error' }, { status: isDup ? 409 : 500 })
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const db = await getDb()
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const id = isNonEmptyString(body?.id) && ObjectId.isValid(body.id) ? new ObjectId(body.id) : null

  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const res = await db.collection('subscriptionPlans').deleteOne({ _id: id })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  
return NextResponse.json({ success: true })
}
