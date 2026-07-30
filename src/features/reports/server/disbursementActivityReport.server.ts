import { ObjectId, type Db } from 'mongodb'

import { buildRoleScopedLeadFilter } from '@features/reports/server/reportContext.server'
import { endOfDayIso, startOfDayIso } from '@features/reports/server/reportContext.server'
import { buildDisbursementTrackerDetailsLookupStages } from '@features/loan-cases/utils/progressivePaymentListFilter'
import { resolveReportLeadAmount } from '@features/reports/utils/reportLeadAmount'

export type DisbursementActivityLeadRow = {
  leadId: string
  customerId: string | null
  assignedAgentId: string | null
  loanTypeId: string | null
  bankName: string | null
  leadCode: string | null
  customerName: string | null
  loanTypeName: string | null
  stageName: string | null
  agentName: string | null
  approvedAmount: number | null
  requestedAmount: number | null
  createdAt: string | null
  periodDisbursedAmount: number
  lastDisbursedDate: string
  disbursementTracker: Record<string, unknown> | null
}

function buildLeadDimensionFilter(
  tenantIdObj: ObjectId,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  options: {
    showInactive?: boolean
    assignedAgentId?: string | null
    customerId?: string | null
    loanTypeId?: string | null
    bankName?: string | null
  } = {}
) {
  const filter: Record<string, unknown> = {
    ...buildRoleScopedLeadFilter(tenantIdObj, userId, role),
    tenantId: tenantIdObj
  }

  if (!options.showInactive) filter.isActive = { $ne: false }
  if (options.assignedAgentId && ObjectId.isValid(options.assignedAgentId)) {
    filter.assignedAgentId = new ObjectId(options.assignedAgentId)
  }
  if (options.customerId && ObjectId.isValid(options.customerId)) {
    filter.customerId = new ObjectId(options.customerId)
  }
  if (options.loanTypeId && ObjectId.isValid(options.loanTypeId)) {
    filter.loanTypeId = new ObjectId(options.loanTypeId)
  }
  if (options.bankName) filter.bankName = options.bankName

  return filter
}

function buildDisbursementDateMatch(tenantIdObj: ObjectId, dateFrom: string | null, dateTo: string | null) {
  const match: Record<string, unknown> = { tenantId: tenantIdObj }

  if (dateFrom || dateTo) {
    const disbursedDate: Record<string, Date> = {}

    if (dateFrom) disbursedDate.$gte = startOfDayIso(dateFrom)
    if (dateTo) disbursedDate.$lte = endOfDayIso(dateTo)
    match.disbursedDate = disbursedDate
  }

  return match
}

export async function getDisbursementActivityLeadsInRange(
  db: Db,
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  dateFrom: string | null,
  dateTo: string | null,
  options: {
    showInactive?: boolean
    assignedAgentId?: string | null
    customerId?: string | null
    loanTypeId?: string | null
    bankName?: string | null
  } = {}
): Promise<DisbursementActivityLeadRow[]> {
  if (!dateFrom && !dateTo) return []

  const leadDimensionFilter = buildLeadDimensionFilter(tenantIdObj, userId, role, options)

  const rows = await db
    .collection('loanDisbursements')
    .aggregate([
      { $match: buildDisbursementDateMatch(tenantIdObj, dateFrom, dateTo) },
      {
        $group: {
          _id: '$leadId',
          periodDisbursedAmount: { $sum: '$amount' },
          lastDisbursedDate: { $max: '$disbursedDate' }
        }
      },
      {
        $lookup: {
          from: 'loanCases',
          localField: '_id',
          foreignField: '_id',
          as: 'lead'
        }
      },
      { $unwind: '$lead' },
      { $replaceRoot: { newRoot: { $mergeObjects: ['$lead', { periodDisbursedAmount: '$periodDisbursedAmount', lastDisbursedDate: '$lastDisbursedDate' }] } } },
      { $match: leadDimensionFilter },
      {
        $lookup: {
          from: 'customers',
          localField: 'customerId',
          foreignField: '_id',
          pipeline: [{ $project: { fullName: 1 } }],
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'loanTypes',
          localField: 'loanTypeId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'loanType'
        }
      },
      { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'loanStatusPipelineStages',
          localField: 'stageId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'stage'
        }
      },
      { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedAgentId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'agent'
        }
      },
      { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
      ...buildDisbursementTrackerDetailsLookupStages(tenantIdObj, tenantIdHex),
      {
        $project: {
          leadId: { $toString: '$_id' },
          customerId: { $toString: '$customerId' },
          assignedAgentId: { $toString: '$assignedAgentId' },
          loanTypeId: { $toString: '$loanTypeId' },
          bankName: 1,
          leadCode: '$code',
          customerName: '$customer.fullName',
          loanTypeName: '$loanType.name',
          stageName: '$stage.name',
          agentName: '$agent.name',
          approvedAmount: 1,
          requestedAmount: 1,
          createdAt: 1,
          periodDisbursedAmount: 1,
          lastDisbursedDate: 1,
          disbursementTracker: 1
        }
      },
      { $sort: { lastDisbursedDate: -1 } }
    ])
    .toArray()

  return rows.map(row => ({
    leadId: String(row.leadId),
    customerId: row.customerId ? String(row.customerId) : null,
    assignedAgentId: row.assignedAgentId ? String(row.assignedAgentId) : null,
    loanTypeId: row.loanTypeId ? String(row.loanTypeId) : null,
    bankName: row.bankName != null ? String(row.bankName) : null,
    leadCode: row.leadCode ? String(row.leadCode) : null,
    customerName: row.customerName ? String(row.customerName) : null,
    loanTypeName: row.loanTypeName ? String(row.loanTypeName) : null,
    stageName: row.stageName ? String(row.stageName) : null,
    agentName: row.agentName ? String(row.agentName) : null,
    approvedAmount: row.approvedAmount != null ? Number(row.approvedAmount) : null,
    requestedAmount: row.requestedAmount != null ? Number(row.requestedAmount) : null,
    createdAt: row.createdAt ? new Date(row.createdAt as Date).toISOString() : null,
    periodDisbursedAmount: Number(row.periodDisbursedAmount || 0),
    lastDisbursedDate: row.lastDisbursedDate
      ? new Date(row.lastDisbursedDate as Date).toISOString().slice(0, 10)
      : '',
    disbursementTracker: (row.disbursementTracker as Record<string, unknown> | null) ?? null
  }))
}

export function resolveMergedLeadAmount(
  periodDisbursedAmount: number | null | undefined,
  leadAmount: number | null | undefined
) {
  if (periodDisbursedAmount != null && periodDisbursedAmount > 0) return periodDisbursedAmount

  return leadAmount ?? 0
}

export async function getDisbursementActivitySummary(
  db: Db,
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  dateFrom: string | null,
  dateTo: string | null,
  assignedAgentId?: string | null
) {
  const leads = await getDisbursementActivityLeadsInRange(db, tenantIdObj, tenantIdHex, userId, role, dateFrom, dateTo, {
    assignedAgentId
  })

  const uniqueCustomers = new Set(leads.map(lead => lead.customerId).filter(Boolean))

  return {
    totalCases: leads.length,
    totalAmount: leads.reduce(
      (sum, lead) =>
        sum +
        resolveMergedLeadAmount(
          lead.periodDisbursedAmount,
          resolveReportLeadAmount({ approvedAmount: lead.approvedAmount, requestedAmount: lead.requestedAmount })
        ),
      0
    ),
    uniqueCustomers: uniqueCustomers.size,
    leadIds: leads.map(lead => lead.leadId)
  }
}
