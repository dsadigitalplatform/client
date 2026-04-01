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

function canAccessCase(role: 'OWNER' | 'ADMIN' | 'USER', userId: ObjectId, row: any) {
  if (role === 'ADMIN' || role === 'OWNER') return true

  const createdBy = (row as any).createdBy as ObjectId | undefined
  const assignedAgentId = (row as any).assignedAgentId as ObjectId | undefined | null

  if (createdBy && createdBy.equals(userId)) return true
  if (assignedAgentId && assignedAgentId.equals(userId)) return true

  return false
}

function toNullableText(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()

  return text.length > 0 ? text : null
}

function resolveAction(row: any) {
  const direct = String((row as any)?.action || '')
  const requested = toNullableText((row as any)?.metadata?.requestedAction)

  return requested || direct
}

function actionLabel(action: string) {
  switch (action) {
    case 'LEAD_CREATED':
      return 'Lead created'
    case 'LEAD_LOAN_TYPE_CHANGED':
      return 'Loan type changed'
    case 'LEAD_ASSIGNED_AGENT_CHANGED':
      return 'Assigned agent changed'
    case 'LEAD_STATUS_CHANGED':
      return 'Lead status changed'
    case 'LEAD_REQUESTED_AMOUNT_CHANGED':
      return 'Requested amount changed'
    case 'LEAD_DELETED':
      return 'Lead deleted'
    default:
      return action.replaceAll('_', ' ').toLowerCase()
  }
}

function buildChanges(action: string, metadata: any) {
  if (action === 'LEAD_CREATED') {
    return [
      { label: 'Customer', from: null, to: null, value: toNullableText(metadata?.customerName) || toNullableText(metadata?.customerId) },
      { label: 'Loan Type', from: null, to: null, value: toNullableText(metadata?.loanTypeName) || toNullableText(metadata?.loanTypeId) },
      { label: 'Status', from: null, to: null, value: toNullableText(metadata?.stageName) || toNullableText(metadata?.stageId) },
      {
        label: 'Assigned Agent',
        from: null,
        to: null,
        value: toNullableText(metadata?.assignedAgentName) || toNullableText(metadata?.assignedAgentEmail) || toNullableText(metadata?.assignedAgentId)
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'LEAD_LOAN_TYPE_CHANGED') {
    return [
      {
        label: 'Loan Type',
        from: toNullableText(metadata?.fromLoanTypeName) || toNullableText(metadata?.fromLoanTypeId),
        to: toNullableText(metadata?.toLoanTypeName) || toNullableText(metadata?.toLoanTypeId),
        value: null
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'LEAD_ASSIGNED_AGENT_CHANGED') {
    return [
      {
        label: 'Assigned Agent',
        from:
          toNullableText(metadata?.fromAssignedAgentName) ||
          toNullableText(metadata?.fromAssignedAgentEmail) ||
          toNullableText(metadata?.fromAssignedAgentId) ||
          'Unassigned',
        to:
          toNullableText(metadata?.toAssignedAgentName) ||
          toNullableText(metadata?.toAssignedAgentEmail) ||
          toNullableText(metadata?.toAssignedAgentId) ||
          'Unassigned',
        value: null
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'LEAD_STATUS_CHANGED') {
    return [
      {
        label: 'Status',
        from: toNullableText(metadata?.fromStageName) || toNullableText(metadata?.fromStageId),
        to: toNullableText(metadata?.toStageName) || toNullableText(metadata?.toStageId),
        value: null
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'LEAD_REQUESTED_AMOUNT_CHANGED') {
    return [
      {
        label: 'Requested Amount',
        from: metadata?.fromRequestedAmount == null ? null : `₹${Number(metadata.fromRequestedAmount).toLocaleString('en-IN')}`,
        to: metadata?.toRequestedAmount == null ? null : `₹${Number(metadata.toRequestedAmount).toLocaleString('en-IN')}`,
        value: null
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'LEAD_DELETED') {
    return [
      {
        label: 'Record',
        from: 'Active',
        to: 'Inactive',
        value: null
      }
    ].filter(c => c.value || c.from || c.to)
  }

  return []
}

async function getTenantContext(session: any) {
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

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    userId,
    role: String((membership as any).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as any)

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx
  const caseRow = await db.collection('loanCases').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!caseRow) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canAccessCase(role, userId, caseRow)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const rows = await db
    .collection('auditLogs')
    .find({
      targetTenantId: tenantIdObj,
      $or: [{ 'metadata.leadId': id }, { 'metadata.leadId': new ObjectId(id) }]
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const actorIds = Array.from(
    new Set(
      rows
        .map(r => ((r as any).actorUserId as ObjectId | null) || null)
        .filter((v): v is ObjectId => Boolean(v))
        .map(v => v.toHexString())
    )
  ).map(v => new ObjectId(v))

  const actorRows =
    actorIds.length > 0
      ? await db.collection('users').find({ _id: { $in: actorIds } }, { projection: { _id: 1, name: 1, email: 1 } }).toArray()
      : []

  const actorById = new Map<string, { name: string | null; email: string | null }>()

  actorRows.forEach(r => {
    actorById.set(String((r as any)._id), {
      name: toNullableText((r as any).name),
      email: toNullableText((r as any).email)
    })
  })

  const items = rows.map(r => {
    const metadata = (r as any).metadata || {}
    const action = resolveAction(r)
    const actorUserIdObj = ((r as any).actorUserId as ObjectId | null) || null
    const actorLookup = actorUserIdObj ? actorById.get(actorUserIdObj.toHexString()) : null

    return {
      id: String((r as any)._id),
      action,
      actionLabel: actionLabel(action),
      actorUserId: actorUserIdObj ? actorUserIdObj.toHexString() : null,
      actorName: actorLookup?.name || null,
      actorEmail: actorLookup?.email || null,
      createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null,
      changes: buildChanges(action, metadata)
    }
  })

  return NextResponse.json({ items })
}
