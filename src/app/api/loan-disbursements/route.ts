export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import {
  computeProgressPercent,
  resolveApprovedAmount
} from '@features/loan-disbursements/utils/disbursementCalculations'
import {
  canAccessCase,
  canViewTrackerInList,
  getActorName,
  getTenantContext,
  writeAuditLog,
  type DisbursementTrackerDoc,
  type LoanCaseAccessDoc
} from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as Parameters<typeof getTenantContext>[0])

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx
  const url = new URL(request.url)
  const assignedAgentIdParam = url.searchParams.get('assignedAgentId') || ''
  const filterAssignedAgentId =
    role === 'ADMIN' || role === 'OWNER' ? assignedAgentIdParam.trim() || null : null

  if (filterAssignedAgentId && !ObjectId.isValid(filterAssignedAgentId)) {
    return NextResponse.json({ error: 'invalid_assignedAgentId' }, { status: 400 })
  }

  const trackers = await db
    .collection('loanDisbursementTrackers')
    .find({ tenantId: tenantIdObj })
    .sort({ updatedAt: -1 })
    .toArray()

  if (trackers.length === 0) {
    return NextResponse.json({ trackers: [], summary: { total: 0, pending: 0, partial: 0, completed: 0, totalDisbursed: 0 } })
  }

  const trackerDocs = trackers.map(t => t as unknown as DisbursementTrackerDoc)
  const leadIds = trackerDocs.map(t => t.leadId)
  const trackerIds = trackerDocs.map(t => t._id)

  const [leads, disbursementCounts] = await Promise.all([
    db
      .collection('loanCases')
      .aggregate([
        { $match: { tenantId: tenantIdObj, _id: { $in: leadIds } } },
        {
          $lookup: {
            from: 'customers',
            localField: 'customerId',
            foreignField: '_id',
            as: 'customer'
          }
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'loanTypes',
            localField: 'loanTypeId',
            foreignField: '_id',
            as: 'loanType'
          }
        },
        { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'loanStatusPipelineStages',
            localField: 'stageId',
            foreignField: '_id',
            as: 'stage'
          }
        },
        { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'users',
            localField: 'assignedAgentId',
            foreignField: '_id',
            as: 'assignedAgent'
          }
        },
        { $unwind: { path: '$assignedAgent', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            customerId: 1,
            createdBy: 1,
            assignedAgentId: 1,
            bankName: 1,
            customerName: { $ifNull: ['$customer.fullName', ''] },
            loanTypeName: { $ifNull: ['$loanType.name', ''] },
            stageName: { $ifNull: ['$stage.name', ''] },
            assignedAgentName: { $ifNull: ['$assignedAgent.name', null] }
          }
        }
      ])
      .toArray(),
    db
      .collection('loanDisbursements')
      .aggregate([
        { $match: { tenantId: tenantIdObj, trackerId: { $in: trackerIds } } },
        { $group: { _id: '$trackerId', count: { $sum: 1 } } }
      ])
      .toArray()
  ])

  const leadById = new Map(leads.map(l => [String((l as { _id: ObjectId })._id), l]))
  const countByTracker = new Map(disbursementCounts.map(r => [String((r as { _id: ObjectId })._id), Number((r as { count: number }).count || 0)]))

  const items = trackerDocs
    .filter(t => {
      const lead = leadById.get(String(t.leadId))

      if (!lead) return false

      return canViewTrackerInList(
        role,
        userId,
        lead as { assignedAgentId?: ObjectId | null },
        filterAssignedAgentId
      )
    })
    .map(t => {
      const lead = leadById.get(String(t.leadId)) as Record<string, unknown>
      const approvedAmount = Number(t.approvedAmount || 0)
      const totalDisbursedAmount = Number(t.totalDisbursedAmount || 0)
      const trackerId = String(t._id)

      return {
        id: trackerId,
        leadId: String(t.leadId),
        customerName: String(lead?.customerName || ''),
        loanTypeName: String(lead?.loanTypeName || ''),
        stageName: String(lead?.stageName || ''),
        bankName: (lead?.bankName as string | null) ?? null,
        assignedAgentId: lead?.assignedAgentId ? String(lead.assignedAgentId) : null,
        assignedAgentName: (lead?.assignedAgentName as string | null) ?? null,
        approvedAmount,
        totalDisbursedAmount,
        remainingAmount: Number(t.remainingAmount || 0),
        disbursementStatus: t.disbursementStatus,
        progressPercent: computeProgressPercent(approvedAmount, totalDisbursedAmount),
        disbursementCount: countByTracker.get(trackerId) || 0,
        createdByName: String(t.createdByName || ''),
        createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
        updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null
      }
    })

  const summary = {
    total: items.length,
    pending: items.filter(i => i.disbursementStatus === 'PENDING').length,
    partial: items.filter(i => i.disbursementStatus === 'PARTIAL').length,
    completed: items.filter(i => i.disbursementStatus === 'COMPLETED').length,
    totalDisbursed: items.reduce((sum, i) => sum + i.totalDisbursedAmount, 0)
  }

  return NextResponse.json({ trackers: items, summary })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as Parameters<typeof getTenantContext>[0])

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx
  const body = await request.json().catch(() => ({}))
  const leadId = String(body?.leadId || '').trim()
  const errors: Record<string, string> = {}

  if (!ObjectId.isValid(leadId)) errors.leadId = 'Invalid lead'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const leadIdObj = new ObjectId(leadId)

  const lead = await db.collection('loanCases').findOne({ _id: leadIdObj, tenantId: tenantIdObj })

  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const leadDoc = lead as unknown as LoanCaseAccessDoc

  if (!canAccessCase(role, userId, leadDoc)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (leadDoc.isActive === false) {
    return NextResponse.json({ error: 'lead_inactive', message: 'Cannot track disbursement for an inactive lead' }, { status: 400 })
  }
  if (!leadDoc.enableProgressivePayment) {
    return NextResponse.json(
      { error: 'progressive_not_enabled', message: 'Enable progressive payment on the lead first' },
      { status: 400 }
    )
  }

  const stage = await db.collection('loanStatusPipelineStages').findOne(
    { _id: leadDoc.stageId, tenantId: tenantIdObj },
    { projection: { name: 1 } }
  )
  const stageName = String((stage as { name?: string })?.name || '')

  const existing = await db.collection('loanDisbursementTrackers').findOne({ tenantId: tenantIdObj, leadId: leadIdObj })

  if (existing) {
    return NextResponse.json(
      { error: 'tracker_exists', message: 'A disbursement tracker already exists for this lead', trackerId: String((existing as { _id: ObjectId })._id) },
      { status: 409 }
    )
  }

  const approvedAmount = resolveApprovedAmount(leadDoc)

  if (approvedAmount == null || approvedAmount <= 0) {
    return NextResponse.json(
      { error: 'invalid_approved_amount', message: 'Lead must have a requested or approved amount' },
      { status: 400 }
    )
  }

  const now = new Date()
  const createdByName = await getActorName(db, userId)

  const doc = {
    tenantId: tenantIdObj,
    leadId: leadIdObj,
    approvedAmount,
    totalDisbursedAmount: 0,
    remainingAmount: approvedAmount,
    disbursementStatus: 'PENDING' as const,
    createdByUserId: userId,
    createdByName,
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('loanDisbursementTrackers').insertOne(doc)

  const [customer, loanType] = await Promise.all([
    db.collection('customers').findOne({ _id: leadDoc.customerId }, { projection: { fullName: 1 } }),
    db.collection('loanTypes').findOne({ _id: leadDoc.loanTypeId }, { projection: { name: 1 } })
  ])

  await writeAuditLog({
    db,
    actorUserId: userId,
    targetTenantId: tenantIdObj,
    action: 'DISBURSEMENT_TRACKER_CREATED',
    metadata: {
      trackerId: res.insertedId.toHexString(),
      leadId,
      customerName: (customer as { fullName?: string })?.fullName ? String((customer as { fullName?: string }).fullName) : null,
      loanTypeName: (loanType as { name?: string })?.name ? String((loanType as { name?: string }).name) : null,
      approvedAmount,
      stageName
    }
  })

  return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
}
