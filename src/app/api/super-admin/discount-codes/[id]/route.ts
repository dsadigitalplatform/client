export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { serializeDiscountCode } from '@features/subscriptions/services/discountCodes.server'

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
  const res = await db.collection('discountCodes').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: 'after' }
  )

  const doc = (res as any)?.value ?? res

  if (!doc || !(doc as any)._id) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ discount: serializeDiscountCode(doc as any) })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await ctx.params

  if (!isNonEmptyString(id) || !ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const db = await getDb()
  const res = await db.collection('discountCodes').deleteOne({ _id: new ObjectId(id) })

  if (!res.deletedCount) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
