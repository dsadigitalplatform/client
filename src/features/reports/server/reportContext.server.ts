import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'

export function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export async function getReportTenantContext(session: { userId?: string; user?: { email?: string | null }; currentTenantId?: string }) {
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String(session?.currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  if (!ObjectId.isValid(currentTenantId)) return { error: NextResponse.json({ error: 'invalid_tenant' }, { status: 400 }) }

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String(session?.user?.email || '')

  const emailFilter =
    email && email.length > 0 ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } } : undefined

  const orFilters = [{ userId }] as Array<Record<string, unknown>>

  if (emailFilter) orFilters.push(emailFilter)

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    tenantIdHex: currentTenantId,
    userId,
    role: String((membership as { role?: string }).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

export function buildRoleScopedLeadFilter(
  tenantIdObj: ObjectId,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER'
) {
  const filter: Record<string, unknown> = { tenantId: tenantIdObj }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    filter.$or = [{ createdBy: userId }, { assignedAgentId: userId }]
  }

  return filter
}

export function parseIsoDateParam(value: string | null | undefined) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null

  return value
}

export function startOfDayIso(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`)
}

export function endOfDayIso(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`)
}
