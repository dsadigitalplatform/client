export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'
import { canAccessCase, getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as Parameters<typeof getTenantContext>[0])

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx

  const [leads, existingTrackers] = await Promise.all([
    db
      .collection('loanCases')
      .aggregate([
        {
          $match: {
            tenantId: tenantIdObj,
            isActive: { $ne: false },
            enableProgressivePayment: true
          }
        },
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
            requestedAmount: 1,
            approvedAmount: 1,
            updatedAt: 1,
            customerName: { $ifNull: ['$customer.fullName', ''] },
            loanTypeName: { $ifNull: ['$loanType.name', ''] },
            stageName: { $ifNull: ['$stage.name', ''] },
            assignedAgentName: { $ifNull: ['$assignedAgent.name', null] }
          }
        }
      ])
      .toArray(),
    db.collection('loanDisbursementTrackers').find({ tenantId: tenantIdObj }, { projection: { leadId: 1 } }).toArray()
  ])

  const trackedLeadIds = new Set(
    existingTrackers.map(t => String((t as unknown as { leadId: ObjectId }).leadId))
  )

  const items = leads
    .filter(row => {
      if (!canAccessCase(role, userId, row as { createdBy?: ObjectId; assignedAgentId?: ObjectId | null })) return false
      if (trackedLeadIds.has(String((row as { _id: ObjectId })._id))) return false

      const resolved = resolveApprovedAmount(row as { approvedAmount?: number | null; requestedAmount?: number | null })

      return resolved != null && resolved > 0
    })
    .map(row => {
      const resolvedApprovedAmount = resolveApprovedAmount(
        row as { approvedAmount?: number | null; requestedAmount?: number | null }
      )

      return {
        id: String((row as { _id: ObjectId })._id),
        customerId: String((row as { customerId: ObjectId }).customerId || ''),
        customerName: String((row as { customerName?: string }).customerName || ''),
        loanTypeName: String((row as { loanTypeName?: string }).loanTypeName || ''),
        stageName: String((row as { stageName?: string }).stageName || ''),
        bankName: (row as { bankName?: string | null }).bankName ?? null,
        requestedAmount: (row as { requestedAmount?: number | null }).requestedAmount ?? null,
        approvedAmount: (row as { approvedAmount?: number | null }).approvedAmount ?? null,
        resolvedApprovedAmount,
        assignedAgentName: (row as { assignedAgentName?: string | null }).assignedAgentName ?? null,
        updatedAt: (row as { updatedAt?: Date }).updatedAt
          ? new Date((row as { updatedAt: Date }).updatedAt).toISOString()
          : null
      }
    })

  return NextResponse.json({ leads: items })
}
