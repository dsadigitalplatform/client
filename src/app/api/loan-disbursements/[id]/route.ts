export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { computeProgressPercent } from '@features/loan-disbursements/utils/disbursementCalculations'
import {
  canAccessCase,
  formatINR,
  getActorName,
  getTenantContext,
  writeAuditLog,
  type DisbursementTrackerDoc,
  type LoanCaseAccessDoc
} from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

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

  const lead = await db.collection('loanCases').findOne({ _id: t.leadId, tenantId: tenantIdObj })

  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const leadDoc = lead as unknown as LoanCaseAccessDoc

  if (!canAccessCase(role, userId, leadDoc)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const [customer, loanType, stage, disbursements] = await Promise.all([
    db.collection('customers').findOne({ _id: leadDoc.customerId }, { projection: { fullName: 1 } }),
    db.collection('loanTypes').findOne({ _id: leadDoc.loanTypeId }, { projection: { name: 1 } }),
    db.collection('loanStatusPipelineStages').findOne({ _id: leadDoc.stageId }, { projection: { name: 1 } }),
    db
      .collection('loanDisbursements')
      .find({ tenantId: tenantIdObj, trackerId: trackerIdObj })
      .sort({ disbursedDate: -1, createdAt: -1 })
      .toArray()
  ])

  const approvedAmount = Number(t.approvedAmount || 0)
  const totalDisbursedAmount = Number(t.totalDisbursedAmount || 0)

  return NextResponse.json({
    id: String(t._id),
    leadId: String(t.leadId),
    customerId: String(leadDoc.customerId || ''),
    customerName: (customer as { fullName?: string })?.fullName ? String((customer as { fullName?: string }).fullName) : '',
    loanTypeName: (loanType as { name?: string })?.name ? String((loanType as { name?: string }).name) : '',
    stageName: (stage as { name?: string })?.name ? String((stage as { name?: string }).name) : '',
    bankName: leadDoc.bankName ?? null,
    approvedAmount,
    totalDisbursedAmount,
    remainingAmount: Number(t.remainingAmount || 0),
    disbursementStatus: t.disbursementStatus,
    progressPercent: computeProgressPercent(approvedAmount, totalDisbursedAmount),
    createdByUserId: String(t.createdByUserId),
    createdByName: String(t.createdByName || ''),
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : null,
    disbursements: disbursements.map(d => {
      const row = d as unknown as {
        _id: ObjectId
        amount?: number
        disbursedDate?: Date
        reason?: string
        bankReference?: string | null
        createdByUserId?: ObjectId
        createdByName?: string
        createdAt?: Date
      }

      return {
        id: String(row._id),
        amount: Number(row.amount || 0),
        disbursedDate: row.disbursedDate ? new Date(row.disbursedDate).toISOString() : null,
        reason: String(row.reason || ''),
        bankReference: row.bankReference ?? null,
        createdByUserId: String(row.createdByUserId || ''),
        createdByName: String(row.createdByName || ''),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null
      }
    })
  })
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const lead = await db.collection('loanCases').findOne({ _id: t.leadId, tenantId: tenantIdObj })

  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const leadDoc = lead as unknown as LoanCaseAccessDoc

  if (!canAccessCase(role, userId, leadDoc)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const leadId = t.leadId.toHexString()
  const approvedAmount = Number(t.approvedAmount || 0)
  const totalDisbursedAmount = Number(t.totalDisbursedAmount || 0)

  const [customer, loanType, stage, disbursementCount] = await Promise.all([
    db.collection('customers').findOne({ _id: leadDoc.customerId }, { projection: { fullName: 1 } }),
    db.collection('loanTypes').findOne({ _id: leadDoc.loanTypeId }, { projection: { name: 1 } }),
    db.collection('loanStatusPipelineStages').findOne({ _id: leadDoc.stageId }, { projection: { name: 1 } }),
    db.collection('loanDisbursements').countDocuments({ tenantId: tenantIdObj, trackerId: trackerIdObj })
  ])

  await writeAuditLog({
    db,
    actorUserId: userId,
    targetTenantId: tenantIdObj,
    action: 'DISBURSEMENT_TRACKER_DELETED',
    metadata: {
      trackerId: id,
      leadId,
      customerName: (customer as { fullName?: string })?.fullName ? String((customer as { fullName?: string }).fullName) : null,
      loanTypeName: (loanType as { name?: string })?.name ? String((loanType as { name?: string }).name) : null,
      stageName: (stage as { name?: string })?.name ? String((stage as { name?: string }).name) : null,
      approvedAmount,
      totalDisbursedAmount,
      remainingAmount: Number(t.remainingAmount || 0),
      disbursementStatus: t.disbursementStatus,
      disbursementCount,
      deletedByName: await getActorName(db, userId)
    }
  })

  await db.collection('loanDisbursements').deleteMany({ tenantId: tenantIdObj, trackerId: trackerIdObj })
  await db.collection('loanDisbursementTrackers').deleteOne({ _id: trackerIdObj, tenantId: tenantIdObj })

  return NextResponse.json({
    ok: true,
    leadId,
    message:
      disbursementCount > 0
        ? `Tracker removed. ${disbursementCount} recorded disbursement${disbursementCount === 1 ? '' : 's'} (${formatINR(totalDisbursedAmount)}) preserved in audit only.`
        : 'Tracker removed. You can now edit the approved amount on the lead.'
  })
}
