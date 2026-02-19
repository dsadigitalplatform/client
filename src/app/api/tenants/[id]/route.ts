import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam) || !ObjectId.isValid(idParam)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const name = isNonEmptyString(body?.name) ? body.name.trim() : undefined
  const type = body?.type === 'sole_trader' || body?.type === 'company' ? body.type : undefined

  if (!name && !type) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 })
  }

  const db = await getDb()
  const userId = new ObjectId(session.userId!)
  const tenantId = new ObjectId(idParam)

  const membership = await db
    .collection('memberships')
    .findOne({ userId, tenantId, status: 'active' }, { projection: { role: 1 } })

  const role = (membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined) || undefined

  if (!membership || (role !== 'OWNER' && role !== 'ADMIN')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const update: any = { updatedAt: new Date() }

  if (name) update.name = name
  if (type) update.type = type

  const res = await db
    .collection('tenants')
    .findOneAndUpdate({ _id: tenantId }, { $set: update }, { returnDocument: 'after' })

  if (!res?.value) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const t = res.value

  
return NextResponse.json({
    tenant: {
      _id: (t._id as ObjectId).toHexString(),
      name: t.name as string,
      type: t.type as 'sole_trader' | 'company',
      status: t.status as 'active' | 'suspended',
      subscriptionPlanId: (t as any).subscriptionPlanId ? (t as any).subscriptionPlanId.toHexString() : null,
      updatedAt: (t.updatedAt as Date)?.toISOString?.() || ''
    }
  })
}
