export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = await getDb()
  const userId = new ObjectId(session.userId!)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const rawMemberships = await db
    .collection('memberships')
    .find({ status: 'active', $or: orFilters }, { projection: { tenantId: 1, role: 1 } })
    .toArray()

  const uniqueTenantIds = Array.from(
    new Set(rawMemberships.map(m => (m.tenantId as ObjectId).toHexString()))
  ).map(id => new ObjectId(id))

  let tenants: Array<{ _id: ObjectId; name: string }> = []

  if (uniqueTenantIds.length > 0) {
    tenants = await db
      .collection('tenants')
      .find({ _id: { $in: uniqueTenantIds } }, { projection: { _id: 1, name: 1 } })
      .toArray() as any
  }

  const roleByTenantId = new Map<string, 'OWNER' | 'ADMIN' | 'USER'>()

  rawMemberships.forEach(m => roleByTenantId.set((m.tenantId as ObjectId).toHexString(), m.role as any))

  const cookieStore = await cookies()
  const savedTenantId = cookieStore.get('CURRENT_TENANT_ID')?.value
  let currentTenantId: string | undefined
  let currentTenantName: string | undefined
  let currentRole: 'OWNER' | 'ADMIN' | 'USER' | undefined

  if (savedTenantId && ObjectId.isValid(savedTenantId)) {
    const has = roleByTenantId.has(savedTenantId)

    if (has) {
      currentTenantId = savedTenantId
      currentTenantName = tenants.find(t => (t._id as ObjectId).equals(new ObjectId(savedTenantId)))?.name
      currentRole = roleByTenantId.get(savedTenantId)
    }
  }

  if (!currentTenantId && uniqueTenantIds.length === 1) {
    currentTenantId = uniqueTenantIds[0].toHexString()
    currentTenantName = tenants.find(t => (t._id as ObjectId).equals(uniqueTenantIds[0]))?.name
    currentRole = roleByTenantId.get(currentTenantId)
  }

  const tenantsOut = tenants.map(t => ({
    _id: (t._id as ObjectId).toHexString(),
    name: t.name,
    role: roleByTenantId.get((t._id as ObjectId).toHexString()) || 'USER'
  }))

  const user = {
    id: session.userId,
    name: session.user?.name ?? null,
    email: session.user?.email ?? null,
    image: session.user?.image ?? null,
    isSuperAdmin: Boolean((session as any)?.isSuperAdmin)
  }

  const memberships = {
    count: rawMemberships.length,
    tenantIds: uniqueTenantIds.map(id => id.toHexString())
  }

  const currentTenant = currentTenantId
    ? { id: currentTenantId, name: currentTenantName || null, role: currentRole || null }
    : null

  return NextResponse.json({ user, currentTenant, tenants: tenantsOut, memberships })
}
