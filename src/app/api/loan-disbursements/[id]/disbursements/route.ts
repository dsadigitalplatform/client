export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import {
  canAccessCase,
  formatINR,
  getActorName,
  getTenantContext,
  recalcTrackerTotals,
  writeAuditLog,
  type DisbursementTrackerDoc,
  type LoanCaseAccessDoc
} from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as Parameters<typeof getTenantContext>[0])

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx
  const trackerIdObj = new ObjectId(id)
  const body = await request.json().catch(() => ({}))

  const amountRaw = body?.amount
  const amount = amountRaw == null || Number.isNaN(Number(amountRaw)) ? NaN : Number(amountRaw)
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  const bankReferenceRaw = body?.bankReference
  const bankReference =
    bankReferenceRaw == null || String(bankReferenceRaw).trim().length === 0 ? null : String(bankReferenceRaw).trim()
  const disbursedDateRaw = body?.disbursedDate
  const disbursedDate = disbursedDateRaw ? new Date(disbursedDateRaw) : null

  const errors: Record<string, string> = {}

  if (!(amount > 0)) errors.amount = 'Amount must be greater than zero'
  if (!reason) errors.reason = 'Reason is required'
  if (!disbursedDate || Number.isNaN(disbursedDate.getTime())) errors.disbursedDate = 'Valid disbursement date is required'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const tracker = await db.collection('loanDisbursementTrackers').findOne({ _id: trackerIdObj, tenantId: tenantIdObj })

  if (!tracker) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const t = tracker as unknown as DisbursementTrackerDoc

  const lead = await db.collection('loanCases').findOne({ _id: t.leadId, tenantId: tenantIdObj })

  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  const leadDoc = lead as unknown as LoanCaseAccessDoc

  if (!canAccessCase(role, userId, leadDoc)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const approvedAmount = Number(t.approvedAmount || 0)
  const currentTotal = Number(t.totalDisbursedAmount || 0)
  const newTotal = currentTotal + amount

  if (newTotal > approvedAmount) {
    const remaining = Math.max(0, approvedAmount - currentTotal)

    return NextResponse.json(
      {
        error: 'over_disbursement',
        message: `Amount exceeds remaining balance (${formatINR(remaining)} available)`,
        details: { remainingAmount: remaining, requestedAmount: amount }
      },
      { status: 400 }
    )
  }

  if (t.disbursementStatus === 'COMPLETED') {
    return NextResponse.json({ error: 'already_completed', message: 'Disbursement is already fully completed' }, { status: 400 })
  }

  const now = new Date()
  const createdByName = await getActorName(db, userId)

  const disbursementDoc = {
    tenantId: tenantIdObj,
    trackerId: trackerIdObj,
    leadId: t.leadId,
    amount,
    disbursedDate: disbursedDate!,
    reason,
    bankReference,
    createdByUserId: userId,
    createdByName,
    createdAt: now
  }

  const insertRes = await db.collection('loanDisbursements').insertOne(disbursementDoc)

  const allAmounts = await db
    .collection('loanDisbursements')
    .find({ tenantId: tenantIdObj, trackerId: trackerIdObj }, { projection: { amount: 1 } })
    .toArray()

  const amounts = allAmounts.map(r => Number((r as unknown as { amount?: number }).amount || 0))
  const totals = recalcTrackerTotals(approvedAmount, amounts)

  await db.collection('loanDisbursementTrackers').updateOne(
    { _id: trackerIdObj, tenantId: tenantIdObj },
    {
      $set: {
        totalDisbursedAmount: totals.totalDisbursedAmount,
        remainingAmount: totals.remainingAmount,
        disbursementStatus: totals.disbursementStatus,
        updatedAt: now
      }
    }
  )

  const [customer, loanType] = await Promise.all([
    db.collection('customers').findOne({ _id: leadDoc.customerId }, { projection: { fullName: 1 } }),
    db.collection('loanTypes').findOne({ _id: leadDoc.loanTypeId }, { projection: { name: 1 } })
  ])

  await writeAuditLog({
    db,
    actorUserId: userId,
    targetTenantId: tenantIdObj,
    action: 'DISBURSEMENT_RECORDED',
    metadata: {
      trackerId: id,
      leadId: t.leadId.toHexString(),
      disbursementId: insertRes.insertedId.toHexString(),
      customerName: (customer as { fullName?: string })?.fullName ? String((customer as { fullName?: string }).fullName) : null,
      loanTypeName: (loanType as { name?: string })?.name ? String((loanType as { name?: string }).name) : null,
      amount,
      disbursedDate: disbursedDate!.toISOString(),
      reason,
      bankReference,
      totalDisbursedAmount: totals.totalDisbursedAmount,
      remainingAmount: totals.remainingAmount,
      disbursementStatus: totals.disbursementStatus
    }
  })

  return NextResponse.json({
    disbursementId: insertRes.insertedId.toHexString(),
    totalDisbursedAmount: totals.totalDisbursedAmount,
    remainingAmount: totals.remainingAmount,
    disbursementStatus: totals.disbursementStatus
  })
}
