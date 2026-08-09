import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function requireSuperAdmin(session: any) {
  return Boolean(session?.userId && (session.isSuperAdmin || session.user?.isSuperAdmin))
}

/**
 * List users for referral linking.
 * - ?tenantId=… → active members of that organisation
 * - ?q=… → global name/email search (any registered user, no org required)
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const tenantId = searchParams.get('tenantId')?.trim() || ''
  const q = searchParams.get('q')?.trim() || ''

  const db = await getDb()

  if (tenantId && ObjectId.isValid(tenantId)) {
    const memberships = await db
      .collection('memberships')
      .find(
        { tenantId: new ObjectId(tenantId), status: { $in: ['active', 'invited'] } },
        { projection: { userId: 1, role: 1, status: 1 } }
      )
      .toArray()

    const userIds = memberships.map(m => m.userId).filter(Boolean) as ObjectId[]

    if (userIds.length === 0) {
      return NextResponse.json({ users: [] })
    }

    const users = await db
      .collection('users')
      .find(
        { _id: { $in: userIds }, isSuperAdmin: { $ne: true } },
        { projection: { name: 1, email: 1 } }
      )
      .toArray()

    const roleByUser = new Map(memberships.map(m => [String(m.userId), String(m.role || '')]))

    const mapped = users
      .map(u => ({
        id: (u._id as ObjectId).toHexString(),
        name: String(u.name || ''),
        email: String(u.email || ''),
        role: roleByUser.get(String(u._id)) || undefined
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const filtered = q
      ? mapped.filter(
          u =>
            u.name.toLowerCase().includes(q.toLowerCase()) ||
            u.email.toLowerCase().includes(q.toLowerCase())
        )
      : mapped

    return NextResponse.json({ users: filtered })
  }

  if (q.length < 2) {
    return NextResponse.json({ users: [] })
  }

  const rx = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  const users = await db
    .collection('users')
    .find(
      {
        isSuperAdmin: { $ne: true },
        $or: [{ name: rx }, { email: rx }]
      },
      { projection: { name: 1, email: 1 } }
    )
    .limit(20)
    .toArray()

  return NextResponse.json({
    users: users.map(u => ({
      id: (u._id as ObjectId).toHexString(),
      name: String(u.name || ''),
      email: String(u.email || '')
    }))
  })
}
