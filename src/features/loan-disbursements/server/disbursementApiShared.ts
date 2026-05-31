import 'server-only'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { ObjectId } from 'mongodb'

import {
  computeDisbursementStatus,
  computeRemainingAmount
} from '@features/loan-disbursements/utils/disbursementCalculations'

import { getDb } from '@/lib/mongodb'

export type TenantRole = 'OWNER' | 'ADMIN' | 'USER'

export type LoanCaseAccessDoc = {
  customerId: ObjectId
  loanTypeId: ObjectId
  stageId: ObjectId
  bankName?: string | null
  createdBy?: ObjectId
  assignedAgentId?: ObjectId | null
  isActive?: boolean
  enableProgressivePayment?: boolean
  approvedAmount?: number | null
  requestedAmount?: number | null
}

export type DisbursementTrackerDoc = {
  _id: ObjectId
  tenantId: ObjectId
  leadId: ObjectId
  approvedAmount: number
  totalDisbursedAmount: number
  remainingAmount: number
  disbursementStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED'
  createdByUserId: ObjectId
  createdByName: string
  createdAt?: Date
  updatedAt?: Date
}

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export async function getTenantContext(session: { userId?: string; user?: { email?: string }; currentTenantId?: string }) {
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

  if (emailFilter) orFilters.push(emailFilter as any)

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    userId,
    role: String((membership as { role?: string }).role || 'USER') as TenantRole
  }
}

function sameObjectId(a: ObjectId | null | undefined, b: ObjectId | string | null | undefined) {
  if (!a || !b) return false

  const bHex = typeof b === 'string' ? b : b.toHexString()

  return a.equals(b as ObjectId) || a.toHexString() === bHex
}

export function canAccessCase(role: TenantRole, userId: ObjectId, row: { createdBy?: ObjectId; assignedAgentId?: ObjectId | null }) {
  if (role === 'ADMIN' || role === 'OWNER') return true

  const createdBy = row.createdBy
  const assignedAgentId = row.assignedAgentId

  if (createdBy && createdBy.equals(userId)) return true
  if (assignedAgentId && assignedAgentId.equals(userId)) return true

  return false
}

export function canViewTrackerInList(
  role: TenantRole,
  userId: ObjectId,
  lead: { assignedAgentId?: ObjectId | null },
  filterAssignedAgentId?: string | null
) {
  if (role === 'ADMIN' || role === 'OWNER') {
    if (filterAssignedAgentId) {
      if (!ObjectId.isValid(filterAssignedAgentId)) return false

      return sameObjectId(lead.assignedAgentId, filterAssignedAgentId)
    }

    return true
  }

  return sameObjectId(lead.assignedAgentId, userId)
}

export async function writeAuditLog(params: {
  db: Awaited<ReturnType<typeof getDb>>
  actorUserId: ObjectId
  targetTenantId: ObjectId
  action: string
  metadata?: Record<string, unknown>
}) {
  const { db, actorUserId, targetTenantId, action, metadata } = params

  try {
    await db.collection('auditLogs').insertOne({
      actorUserId,
      targetTenantId,
      action,
      metadata: metadata ?? {},
      createdAt: new Date()
    })
  } catch (e: unknown) {
    const errMessage = (e as { message?: string })?.message || String(e)

    if (errMessage.includes('Document failed validation') && action !== 'ADMIN_VIEW') {
      try {
        await db.collection('auditLogs').insertOne({
          actorUserId,
          targetTenantId,
          action: 'ADMIN_VIEW',
          metadata: { ...(metadata ?? {}), requestedAction: action },
          createdAt: new Date()
        })
      } catch (fallbackErr: unknown) {
        console.error('audit_log_write_failed', {
          action,
          fallbackAction: 'ADMIN_VIEW',
          err: (fallbackErr as { message?: string })?.message || String(fallbackErr)
        })
      }
    } else {
      console.error('audit_log_write_failed', { action, err: errMessage })
    }
  }
}

export async function getActorName(db: Awaited<ReturnType<typeof getDb>>, userId: ObjectId) {
  const row = await db.collection('users').findOne({ _id: userId }, { projection: { name: 1, email: 1 } })

  if (!row) return 'Unknown user'

  const name = typeof (row as { name?: string }).name === 'string' ? String((row as { name?: string }).name).trim() : ''

  if (name) return name

  const email = typeof (row as { email?: string }).email === 'string' ? String((row as { email?: string }).email).trim() : ''

  return email || 'Unknown user'
}

export function formatINR(value: number) {
  return `₹${Number(value).toLocaleString('en-IN')}`
}

export function recalcTrackerTotals(approvedAmount: number, disbursementAmounts: number[]) {
  const totalDisbursedAmount = disbursementAmounts.reduce((sum, n) => sum + n, 0)
  const remainingAmount = computeRemainingAmount(approvedAmount, totalDisbursedAmount)
  const disbursementStatus = computeDisbursementStatus(approvedAmount, totalDisbursedAmount)

  return { totalDisbursedAmount, remainingAmount, disbursementStatus }
}
