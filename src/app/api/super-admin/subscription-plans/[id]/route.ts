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

function isValidFeatures(obj: unknown): obj is Record<string, boolean> {
  if (typeof obj !== 'object' || obj == null) return false

  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v !== 'boolean') return false
  }

  
return true
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const db = await getDb()
  let body: any

  try {
    body = await request.json()
  } catch {
    body = {}
  }

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

  if (body?.features != null && !isValidFeatures(body.features)) {
    return NextResponse.json({ error: 'invalid_features' }, { status: 400 })
  }

  if (typeof body?.isActive === 'boolean') update.isActive = body.isActive
  if (typeof body?.isDefault === 'boolean') update.isDefault = body.isDefault

  try {
    const col = db.collection('subscriptionPlans')
    let updatedDoc: any = null

    if (ObjectId.isValid(idParam)) {
      const r1 = await col.updateOne({ _id: new ObjectId(idParam) }, { $set: update })

      if (r1.matchedCount > 0) {
        updatedDoc = await col.findOne({ _id: new ObjectId(idParam) })
      }
    }

    if (!updatedDoc) {
      const r2 = await col.updateOne({ _id: idParam as any }, { $set: update })

      if (r2.matchedCount > 0) {
        updatedDoc = await col.findOne({ _id: idParam as any })
      }
    }

    if (!updatedDoc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const plan = { ...updatedDoc, _id: String(updatedDoc._id) }

    
return NextResponse.json({ plan })
  } catch (e: any) {
    const msg = String(e?.message || '')
    const isDup = msg.includes('duplicate key')
    const isValidation = msg.includes('Document failed validation') || e?.code === 121

    if (isDup) return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    if (isValidation) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
    
return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const db = await getDb()
  const col = db.collection('subscriptionPlans')
  let deletedCount = 0

  if (ObjectId.isValid(idParam)) {
    const res1 = await col.deleteOne({ _id: new ObjectId(idParam) })

    deletedCount = res1.deletedCount || 0
  }

  if (deletedCount === 0) {
    const res2 = await col.deleteOne({ _id: idParam as any })

    if (res2.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    
return NextResponse.json({ success: true })
  }
  
  return NextResponse.json({ success: true })
}
