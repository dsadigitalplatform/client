export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0 ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } } : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { _id: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const activeMemberships = await db
    .collection('memberships')
    .find({ tenantId: tenantIdObj, status: 'active', userId: { $type: 'objectId' } }, { projection: { userId: 1 } })
    .toArray()

  const userIds = activeMemberships.map(m => (m as any).userId as ObjectId).filter(Boolean)

  if (userIds.length === 0) return NextResponse.json({ users: [] })

  const users = await db
    .collection('users')
    .find({ _id: { $in: userIds } }, { projection: { _id: 1, name: 1, email: 1 } })
    .sort({ name: 1 })
    .limit(500)
    .toArray()

  const out = users.map(u => ({
    id: String((u as any)._id),
    name: String((u as any).name || ''),
    email: (u as any).email ?? null
  }))

  return NextResponse.json({ users: out })
}
