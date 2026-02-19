import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

type Role = 'OWNER' | 'ADMIN' | 'USER'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = await getDb()
  const userId = new ObjectId(session.userId!)

  const memberships = await db
    .collection('memberships')
    .find({ userId, status: 'active' }, { projection: { tenantId: 1, role: 1 } })
    .toArray()

  const tenantIds = memberships.map(m => m.tenantId as ObjectId)

  if (tenantIds.length === 0) return NextResponse.json({ tenants: [] })

  const tenants = await db
    .collection('tenants')
    .find(
      { _id: { $in: tenantIds } },
      { projection: { _id: 1, name: 1, type: 1, status: 1, subscriptionPlanId: 1, createdAt: 1, updatedAt: 1 } }
    )
    .toArray()

  const roleById = new Map<string, Role>()

  memberships.forEach(m => roleById.set((m.tenantId as ObjectId).toHexString(), m.role as Role))

  const result = tenants.map(t => ({
    _id: (t._id as ObjectId).toHexString(),
    name: t.name as string,
    type: t.type as 'sole_trader' | 'company',
    status: t.status as 'active' | 'suspended',
    role: roleById.get((t._id as ObjectId).toHexString()) || 'USER',
    subscriptionPlanId: (t as any).subscriptionPlanId ? (t as any).subscriptionPlanId.toHexString() : null,
    createdAt: (t.createdAt as Date)?.toISOString?.() || '',
    updatedAt: (t.updatedAt as Date)?.toISOString?.() || ''
  }))

  return NextResponse.json({ tenants: result })
}
