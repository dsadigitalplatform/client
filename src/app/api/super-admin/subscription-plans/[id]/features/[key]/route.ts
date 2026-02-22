import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string; key: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id
  const keyParam = p?.key

  if (!isNonEmptyString(idParam)) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  if (!isNonEmptyString(keyParam)) return NextResponse.json({ error: 'key_required' }, { status: 400 })

  const db = await getDb()
  const col = db.collection('subscriptionPlans')
  const unsetOp = { [`features.${keyParam}`]: '' }

  let matched = 0

  if (ObjectId.isValid(idParam)) {
    const r1 = await col.updateOne({ _id: new ObjectId(idParam) }, { $unset: unsetOp })

    matched = r1.matchedCount
  }

  if (matched === 0) {
    const r2 = await col.updateOne({ _id: idParam as any }, { $unset: unsetOp })

    matched = r2.matchedCount
  }

  if (matched === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let doc: any = null

  if (ObjectId.isValid(idParam)) doc = await col.findOne({ _id: new ObjectId(idParam) }, { projection: { features: 1 } })
  if (!doc) doc = await col.findOne({ _id: idParam as any }, { projection: { features: 1 } })
  const features = doc?.features && typeof doc.features === 'object' ? doc.features : {}

  
return NextResponse.json({ features })
}
