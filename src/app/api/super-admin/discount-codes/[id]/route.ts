export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import {
  reapplyBestDiscountsForCode,
  serializeDiscountCode
} from '@features/subscriptions/services/discountCodes.server'

function updatedDocument(res: unknown): Record<string, any> | null {
  if (!res || typeof res !== 'object') return null

  const rec = res as Record<string, any>

  // MongoDB Node driver 6+ returns the document directly. Discount codes also have a numeric
  // `value` field, so `res.value` is the percent/amount — never treat that as the document.
  if (rec._id) return rec
  if (rec.value && typeof rec.value === 'object' && rec.value._id) return rec.value as Record<string, any>

  return null
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await ctx.params

  if (!isNonEmptyString(id) || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updatedAt: new Date() }

  if (isNonEmptyString(body?.name)) update.name = body.name.trim()
  if (typeof body?.description === 'string') update.description = body.description.trim()
  if (typeof body?.isActive === 'boolean') update.isActive = body.isActive
  if (body?.validTo) update.validTo = new Date(body.validTo)
  if (body?.validFrom) update.validFrom = new Date(body.validFrom)
  if (typeof body?.maxRedemptions === 'number' || body?.maxRedemptions === null) {
    update.maxRedemptions = body.maxRedemptions
  }

  const db = await getDb()
  const discountId = new ObjectId(id)
  const res = await db.collection('discountCodes').findOneAndUpdate(
    { _id: discountId },
    { $set: update },
    { returnDocument: 'after' }
  )

  const doc = updatedDocument(res)

  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (doc.isActive === false) {
    await reapplyBestDiscountsForCode({ db, discountCodeId: discountId, code: String(doc.code || '') })
  }

  return NextResponse.json({ discount: serializeDiscountCode(doc) })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await ctx.params

  if (!isNonEmptyString(id) || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const db = await getDb()
  const discountId = new ObjectId(id)
  const existing = await db.collection('discountCodes').findOne({ _id: discountId }, { projection: { code: 1 } })
  const res = await db.collection('discountCodes').deleteOne({ _id: discountId })

  if (!res.deletedCount) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  await reapplyBestDiscountsForCode({
    db,
    discountCodeId: discountId,
    code: existing?.code ? String(existing.code) : null
  })

  return NextResponse.json({ success: true })
}
