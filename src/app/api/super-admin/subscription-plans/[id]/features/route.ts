import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isValidFeatures(obj: unknown): obj is Record<string, boolean> {
  if (typeof obj !== 'object' || obj == null) return false

  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v !== 'boolean') return false
  }

  
return true
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) return NextResponse.json({ error: 'id_required' }, { status: 400 })
  const db = await getDb()
  let doc: any = null

  if (ObjectId.isValid(idParam)) {
    doc = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(idParam) }, { projection: { features: 1 } })
  }

  if (!doc) {
    doc = await db.collection('subscriptionPlans').findOne({ _id: idParam as any }, { projection: { features: 1 } })
  }

  if (!doc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const features = doc.features && typeof doc.features === 'object' ? doc.features : {}

  
return NextResponse.json({ features })
}

async function upsertFeatures(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) return NextResponse.json({ error: 'id_required' }, { status: 400 })

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!isValidFeatures(body?.features)) return NextResponse.json({ error: 'invalid_features' }, { status: 400 })

  const db = await getDb()
  const col = db.collection('subscriptionPlans')
  const setOps: Record<string, boolean> = {}

  for (const [k, v] of Object.entries(body.features as Record<string, boolean>)) {
    if (isNonEmptyString(k)) setOps[`features.${k}`] = v
  }

  if (Object.keys(setOps).length === 0) return NextResponse.json({ error: 'invalid_features' }, { status: 400 })

  let matched = 0

  if (ObjectId.isValid(idParam)) {
    const r1 = await col.updateOne({ _id: new ObjectId(idParam) }, { $set: setOps, $setOnInsert: {} })

    matched = r1.matchedCount
  }

  if (matched === 0) {
    const r2 = await col.updateOne({ _id: idParam as any }, { $set: setOps, $setOnInsert: {} })

    matched = r2.matchedCount
  }

  if (matched === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let doc: any = null

  if (ObjectId.isValid(idParam)) doc = await col.findOne({ _id: new ObjectId(idParam) }, { projection: { features: 1 } })
  if (!doc) doc = await col.findOne({ _id: idParam as any }, { projection: { features: 1 } })
  const features = doc?.features && typeof doc.features === 'object' ? doc.features : {}

  
return NextResponse.json({ features })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return upsertFeatures(req, ctx)
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return upsertFeatures(req, ctx)
}
