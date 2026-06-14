export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import {
  canAccessCase,
  formatINR,
  type DisbursementTrackerDoc,
  type LoanCaseAccessDoc
} from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function toNullableText(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()

  return text.length > 0 ? text : null
}

function resolveAction(row: { action?: string; metadata?: { requestedAction?: string } }) {
  const direct = String(row?.action || '')
  const requested = toNullableText(row?.metadata?.requestedAction)

  return requested || direct
}

function actionLabel(action: string) {
  switch (action) {
    case 'DISBURSEMENT_TRACKER_CREATED':
      return 'Tracker created'
    case 'DISBURSEMENT_RECORDED':
      return 'Disbursement recorded'
    case 'DISBURSEMENT_TRACKER_DELETED':
      return 'Tracker deleted'
    default:
      return action.replaceAll('_', ' ').toLowerCase()
  }
}

function buildChanges(action: string, metadata: Record<string, unknown>) {
  if (action === 'DISBURSEMENT_TRACKER_CREATED') {
    return [
      {
        label: 'Customer',
        from: null,
        to: null,
        value: toNullableText(metadata?.customerName)
      },
      {
        label: 'Loan type',
        from: null,
        to: null,
        value: toNullableText(metadata?.loanTypeName)
      },
      {
        label: 'Approved amount',
        from: null,
        to: null,
        value: metadata?.approvedAmount == null ? null : formatINR(Number(metadata.approvedAmount))
      },
      {
        label: 'Stage',
        from: null,
        to: null,
        value: toNullableText(metadata?.stageName)
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'DISBURSEMENT_TRACKER_DELETED') {
    return [
      {
        label: 'Customer',
        from: null,
        to: null,
        value: toNullableText(metadata?.customerName)
      },
      {
        label: 'Approved amount',
        from: null,
        to: null,
        value: metadata?.approvedAmount == null ? null : formatINR(Number(metadata.approvedAmount))
      },
      {
        label: 'Total disbursed',
        from: null,
        to: null,
        value: metadata?.totalDisbursedAmount == null ? null : formatINR(Number(metadata.totalDisbursedAmount))
      },
      {
        label: 'Disbursements removed',
        from: null,
        to: null,
        value: metadata?.disbursementCount == null ? null : String(metadata.disbursementCount)
      },
      {
        label: 'Status at deletion',
        from: null,
        to: null,
        value: toNullableText(metadata?.disbursementStatus)
      }
    ].filter(c => c.value || c.from || c.to)
  }

  if (action === 'DISBURSEMENT_RECORDED') {
    return [
      {
        label: 'Amount',
        from: null,
        to: null,
        value: metadata?.amount == null ? null : formatINR(Number(metadata.amount))
      },
      {
        label: 'Reason',
        from: null,
        to: null,
        value: toNullableText(metadata?.reason)
      },
      {
        label: 'Bank reference',
        from: null,
        to: null,
        value: toNullableText(metadata?.bankReference)
      },
      {
        label: 'Total disbursed',
        from: null,
        to: null,
        value: metadata?.totalDisbursedAmount == null ? null : formatINR(Number(metadata.totalDisbursedAmount))
      },
      {
        label: 'Remaining',
        from: null,
        to: null,
        value: metadata?.remainingAmount == null ? null : formatINR(Number(metadata.remainingAmount))
      },
      {
        label: 'Status',
        from: null,
        to: null,
        value: toNullableText(metadata?.disbursementStatus)
      }
    ].filter(c => c.value || c.from || c.to)
  }

  return []
}

async function getTenantContext(session: { userId?: string; user?: { email?: string }; currentTenantId?: string }) {
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

  const orFilters = [{ userId }] as { userId: ObjectId; email?: { $regex: string; $options: string } }[]

  if (emailFilter) orFilters.push(emailFilter as { userId: ObjectId; email?: { $regex: string; $options: string } })

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    userId,
    role: String((membership as { role?: string }).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as Parameters<typeof getTenantContext>[0])

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx
  const trackerIdObj = new ObjectId(id)

  const tracker = await db.collection('loanDisbursementTrackers').findOne({ _id: trackerIdObj, tenantId: tenantIdObj })

  if (!tracker) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const t = tracker as unknown as DisbursementTrackerDoc
  const trackerLeadId = t.leadId
  const lead = await db.collection('loanCases').findOne({ _id: trackerLeadId, tenantId: tenantIdObj })

  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const leadDoc = lead as unknown as LoanCaseAccessDoc

  if (!canAccessCase(role, userId, leadDoc)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const leadId = trackerLeadId.toHexString()

  const rows = await db
    .collection('auditLogs')
    .find({
      targetTenantId: tenantIdObj,
      $or: [
        { 'metadata.trackerId': id },
        { 'metadata.leadId': leadId },
        { 'metadata.leadId': trackerLeadId }
      ],
      action: { $in: ['DISBURSEMENT_TRACKER_CREATED', 'DISBURSEMENT_RECORDED', 'DISBURSEMENT_TRACKER_DELETED', 'ADMIN_VIEW'] }
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const filtered = rows.filter(r => {
    const action = resolveAction(r as { action?: string; metadata?: { requestedAction?: string } })
    const meta = (r as { metadata?: Record<string, unknown> }).metadata || {}

    if (
      action === 'DISBURSEMENT_TRACKER_CREATED' ||
      action === 'DISBURSEMENT_RECORDED' ||
      action === 'DISBURSEMENT_TRACKER_DELETED'
    ) {
      return String(meta.trackerId || '') === id || String(meta.leadId || '') === leadId
    }

    if (action === 'ADMIN_VIEW') {
      const requested = String((meta as { requestedAction?: string }).requestedAction || '')

      if (requested.startsWith('DISBURSEMENT_')) {
        return String(meta.trackerId || '') === id || String(meta.leadId || '') === leadId
      }
    }

    return false
  })

  const actorIds = Array.from(
    new Set(
      filtered
        .map(r => ((r as { actorUserId?: ObjectId }).actorUserId as ObjectId | null) || null)
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
    actorById.set(String((r as { _id: ObjectId })._id), {
      name: toNullableText((r as { name?: string }).name),
      email: toNullableText((r as { email?: string }).email)
    })
  })

  const items = filtered.map(r => {
    const metadata = ((r as { metadata?: Record<string, unknown> }).metadata || {}) as Record<string, unknown>
    const action = resolveAction(r as { action?: string; metadata?: { requestedAction?: string } })
    const actorUserIdObj = ((r as { actorUserId?: ObjectId }).actorUserId as ObjectId | null) || null
    const actorLookup = actorUserIdObj ? actorById.get(actorUserIdObj.toHexString()) : null

    return {
      id: String((r as { _id: ObjectId })._id),
      action,
      actionLabel: actionLabel(action),
      actorUserId: actorUserIdObj ? actorUserIdObj.toHexString() : null,
      actorName: actorLookup?.name || null,
      actorEmail: actorLookup?.email || null,
      createdAt: (r as { createdAt?: Date }).createdAt
        ? new Date((r as { createdAt?: Date }).createdAt as Date).toISOString()
        : null,
      changes: buildChanges(action, metadata)
    }
  })

  return NextResponse.json({ items })
}
