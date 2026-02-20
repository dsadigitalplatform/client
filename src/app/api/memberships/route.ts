export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

type MembershipRole = 'OWNER' | 'ADMIN' | 'USER'
type MembershipStatus = 'invited' | 'active' | 'revoked'

type MembershipItem = {
  _id: string
  email?: string
  role: MembershipRole
  status: MembershipStatus
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tenantId = url.searchParams.get('tenantId') || ''

  if (!tenantId || !ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: 'invalid_tenantId' }, { status: 400 })
  }

  const db = await getDb()

  const ownerMembership = await db
    .collection('memberships')
    .findOne({
      userId: new ObjectId(session.userId),
      tenantId: new ObjectId(tenantId),
      role: { $in: ['OWNER', 'ADMIN'] },
      status: 'active'
    })

  if (!ownerMembership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const items = await db
    .collection('memberships')
    .find(
      {
        tenantId: new ObjectId(tenantId),
        status: { $in: ['invited', 'active'] },
        userId: { $ne: new ObjectId(session.userId) }
      },
      { projection: { _id: 1, userId: 1, email: 1, role: 1, status: 1 } }
    )
    .toArray()

  const memberships: MembershipItem[] = items.map(m => ({
    _id: (m._id as ObjectId).toHexString(),
    userId: ((m as any).userId as ObjectId | undefined)?.toHexString?.(),
    email: (m as any).email as string | undefined,
    role: m.role as MembershipRole,
    status: m.status as MembershipStatus
  }))

  return NextResponse.json({ memberships })
}
