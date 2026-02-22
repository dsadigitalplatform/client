import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'

import { getDb } from '@/lib/mongodb'

export async function POST(request: Request) {
  const HEX = /^#([A-Fa-f0-9]{6})$/
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const type = body?.type === 'sole_trader' || body?.type === 'company' ? body.type : undefined
  const subscriptionPlanIdRaw = typeof body?.subscriptionPlanId === 'string' ? body.subscriptionPlanId : ''
  const primaryColorRaw = typeof body?.primaryColor === 'string' ? body.primaryColor.trim() : ''
  const primaryColor = primaryColorRaw && HEX.test(primaryColorRaw) ? primaryColorRaw : undefined

  if (!name || !type) return NextResponse.json({ success: false, error: 'invalid_input' }, { status: 400 })

  const db = await getDb()
  const now = new Date()
  const createdBy = new ObjectId(session.userId!)

  let subscriptionPlanId: ObjectId | undefined

  if (subscriptionPlanIdRaw && ObjectId.isValid(subscriptionPlanIdRaw)) {
    const plan = await db
      .collection('subscriptionPlans')
      .findOne({ _id: new ObjectId(subscriptionPlanIdRaw), isActive: true }, { projection: { _id: 1 } })

    if (plan?._id) {
      subscriptionPlanId = plan._id as ObjectId
    }
  }

  const insertTenant = await db.collection('tenants').insertOne({
    name,
    type,
    status: 'active',
    createdBy,
    createdAt: now,
    updatedAt: now,
    ...(subscriptionPlanId ? { subscriptionPlanId } : {}),
    ...(primaryColor ? { theme: { primaryColor } } : {})
  })

  await db.collection('memberships').insertOne({
    userId: createdBy,
    tenantId: insertTenant.insertedId,
    role: 'OWNER',
    status: 'active',
    createdAt: now,
    activatedAt: now
  })

  return NextResponse.json({ success: true, tenantId: insertTenant.insertedId.toHexString() }, { status: 201 })
}
