export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId, type Db } from 'mongodb'

import { authOptions } from '@/lib/auth'
import {
  buildRoleScopedLeadFilter,
  endOfDayIso,
  getReportTenantContext,
  parseIsoDateParam,
  startOfDayIso
} from '@features/reports/server/reportContext.server'
import {
  buildProgressivePaymentFilterStages,
  isProgressivePaymentListFilterMode
} from '@features/loan-cases/utils/progressivePaymentListFilter'
import type {
  ReportBreakdownRow,
  ReportDataMode,
  ReportDetailRow,
  ReportGroupBy,
  ReportMetric,
  ReportSummary,
  ReportTrendGranularity,
  ReportTrendRow,
  ReportViewType
} from '@features/reports/reports.types'

type ReportDb = Db

const STAGE_AUDIT_TIMEZONE = 'Asia/Kolkata'

function effectiveStagedDateExpression() {
  return {
    $let: {
      vars: { submitted: '$metadata.stageSubmittedDate' },
      in: {
        $cond: {
          if: {
            $and: [
              { $ne: ['$$submitted', null] },
              { $ne: ['$$submitted', ''] },
              {
                $regexMatch: {
                  input: { $toString: '$$submitted' },
                  regex: '^\\d{4}-\\d{2}-\\d{2}$'
                }
              }
            ]
          },
          then: { $toString: '$$submitted' },
          else: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: STAGE_AUDIT_TIMEZONE }
          }
        }
      }
    }
  }
}

function parseQueryParams(searchParams: URLSearchParams) {
  const dataMode = (searchParams.get('dataMode') === 'historical' ? 'historical' : 'snapshot') as ReportDataMode

  const groupBy = (['stage', 'agent', 'customer', 'bank', 'loanType', 'time'].includes(String(searchParams.get('groupBy')))
    ? searchParams.get('groupBy')
    : 'stage') as ReportGroupBy

  const view = (['summary', 'detailed', 'trend', 'full'].includes(String(searchParams.get('view')))
    ? searchParams.get('view')
    : 'full') as ReportViewType

  const metric = (searchParams.get('metric') === 'amount' ? 'amount' : 'count') as ReportMetric
  const trendGranularity = (searchParams.get('trendGranularity') === 'month' ? 'month' : 'week') as ReportTrendGranularity

  return {
    dataMode,
    groupBy,
    view,
    metric,
    trendGranularity,
    dateFrom: parseIsoDateParam(searchParams.get('dateFrom')),
    dateTo: parseIsoDateParam(searchParams.get('dateTo')),
    stageId: searchParams.get('stageId') || null,
    assignedAgentId: searchParams.get('assignedAgentId') || null,
    customerId: searchParams.get('customerId') || null,
    loanTypeId: searchParams.get('loanTypeId') || null,
    bankName: searchParams.get('bankName') || null,
    showInactive: searchParams.get('showInactive') === 'true',
    progressivePaymentFilter: (() => {
      const value = searchParams.get('progressivePaymentFilter') || ''

      return isProgressivePaymentListFilterMode(value) ? value : null
    })()
  }
}

function buildSnapshotMatch(
  tenantIdObj: ObjectId,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  filters: ReturnType<typeof parseQueryParams>
) {
  const match: Record<string, unknown> = buildRoleScopedLeadFilter(tenantIdObj, userId, role)

  if (!filters.showInactive) match.isActive = { $ne: false }
  if (filters.stageId && ObjectId.isValid(filters.stageId)) match.stageId = new ObjectId(filters.stageId)
  if (filters.assignedAgentId && ObjectId.isValid(filters.assignedAgentId))
    match.assignedAgentId = new ObjectId(filters.assignedAgentId)
  if (filters.customerId && ObjectId.isValid(filters.customerId)) match.customerId = new ObjectId(filters.customerId)
  if (filters.loanTypeId && ObjectId.isValid(filters.loanTypeId)) match.loanTypeId = new ObjectId(filters.loanTypeId)
  if (filters.bankName) match.bankName = filters.bankName

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Record<string, Date> = {}

    if (filters.dateFrom) createdAt.$gte = startOfDayIso(filters.dateFrom)
    if (filters.dateTo) createdAt.$lte = endOfDayIso(filters.dateTo)
    match.createdAt = createdAt
  }

  return match
}

function buildSnapshotPipelinePrefix(
  match: Record<string, unknown>,
  progressiveStages: Record<string, unknown>[] = []
) {
  return [{ $match: match }, ...progressiveStages]
}

function snapshotGroupId(groupBy: ReportGroupBy) {
  switch (groupBy) {
    case 'agent':
      return '$assignedAgentId'
    case 'customer':
      return '$customerId'
    case 'bank':
      return { $ifNull: ['$bankName', 'Unassigned'] }
    case 'loanType':
      return '$loanTypeId'
    case 'time':
      return null
    case 'stage':
    default:
      return '$stageId'
  }
}

async function runSnapshotReport(
  db: ReportDb,
  match: Record<string, unknown>,
  groupBy: ReportGroupBy,
  view: ReportViewType,
  trendGranularity: ReportTrendGranularity,
  progressiveStages: Record<string, unknown>[] = []
) {
  const pipelinePrefix = buildSnapshotPipelinePrefix(match, progressiveStages)
  const includeBreakdown = view === 'summary' || view === 'full'
  const includeTrend = view === 'trend' || view === 'full'
  const includeDetails = view === 'detailed' || view === 'full'

  const summaryAgg = await db
    .collection('loanCases')
    .aggregate([
      ...pipelinePrefix,
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$requestedAmount', 0] } },
          customers: { $addToSet: '$customerId' }
        }
      }
    ])
    .toArray()

  const summaryRow = summaryAgg[0] || { totalCases: 0, totalAmount: 0, customers: [] }

  const summary: ReportSummary = {
    totalCases: Number(summaryRow.totalCases || 0),
    totalAmount: Number(summaryRow.totalAmount || 0),
    uniqueCustomers: Array.isArray(summaryRow.customers) ? summaryRow.customers.filter(Boolean).length : 0
  }

  let breakdown: ReportBreakdownRow[] = []
  let trend: ReportTrendRow[] = []
  let details: ReportDetailRow[] = []

  if (includeBreakdown && groupBy !== 'time') {
    const groupId = snapshotGroupId(groupBy)

    const breakdownRows = await db
      .collection('loanCases')
      .aggregate([
        ...pipelinePrefix,
        {
          $group: {
            _id: groupId,
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$requestedAmount', 0] } }
          }
        },
        ...(groupBy === 'stage'
          ? [
              {
                $lookup: {
                  from: 'loanStatusPipelineStages',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { name: 1, order: 1 } }],
                  as: 'stage'
                }
              },
              { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
              { $addFields: { label: { $ifNull: ['$stage.name', 'Unassigned'] }, order: '$stage.order' } }
            ]
          : []),
        ...(groupBy === 'agent'
          ? [
              {
                $lookup: {
                  from: 'users',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { name: 1, email: 1 } }],
                  as: 'agent'
                }
              },
              { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  label: {
                    $ifNull: ['$agent.name', { $ifNull: ['$agent.email', 'Unassigned'] }]
                  }
                }
              }
            ]
          : []),
        ...(groupBy === 'customer'
          ? [
              {
                $lookup: {
                  from: 'customers',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { fullName: 1 } }],
                  as: 'customer'
                }
              },
              { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
              { $addFields: { label: { $ifNull: ['$customer.fullName', 'Unknown'] } } }
            ]
          : []),
        ...(groupBy === 'loanType'
          ? [
              {
                $lookup: {
                  from: 'loanTypes',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { name: 1 } }],
                  as: 'loanType'
                }
              },
              { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
              { $addFields: { label: { $ifNull: ['$loanType.name', 'Unknown'] } } }
            ]
          : []),
        ...(groupBy === 'bank' ? [{ $addFields: { label: '$_id' } }] : []),
        {
          $project: {
            key: { $toString: '$_id' },
            label: 1,
            count: 1,
            amount: 1,
            order: 1
          }
        },
        { $sort: groupBy === 'stage' ? { order: 1, label: 1 } : { count: -1, label: 1 } }
      ])
      .toArray()

    breakdown = breakdownRows.map(r => ({
      key: r.key ? String(r.key) : 'unknown',
      label: r.label ? String(r.label) : 'Unknown',
      count: Number(r.count || 0),
      amount: Number(r.amount || 0),
      order: r.order != null ? Number(r.order) : null
    }))
  }

  if (includeTrend) {
    const unit = trendGranularity === 'month' ? 'month' : 'week'

    const trendRows = await db
      .collection('loanCases')
      .aggregate([
        ...pipelinePrefix,
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit } },
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$requestedAmount', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray()

    trend = trendRows.map(r => {
      const d = new Date(r._id)

      return {
        label: d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: trendGranularity === 'month' ? 'numeric' : undefined }),
        periodStart: d.toISOString(),
        count: Number(r.count || 0),
        amount: Number(r.amount || 0)
      }
    })
  }

  if (includeDetails) {
    const detailRows = await db
      .collection('loanCases')
      .aggregate([
        ...pipelinePrefix,
        { $sort: { createdAt: -1 } },
        { $limit: 500 },
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
        {
          $project: {
            leadId: { $toString: '$_id' },
            customerName: '$customer.fullName',
            loanTypeName: '$loanType.name',
            bankName: 1,
            stageName: '$stage.name',
            agentName: '$agent.name',
            requestedAmount: 1,
            createdAt: 1
          }
        }
      ])
      .toArray()

    details = detailRows.map(r => ({
      leadId: String(r.leadId),
      customerName: r.customerName ? String(r.customerName) : null,
      loanTypeName: r.loanTypeName ? String(r.loanTypeName) : null,
      bankName: r.bankName != null ? String(r.bankName) : null,
      stageName: r.stageName ? String(r.stageName) : null,
      agentName: r.agentName ? String(r.agentName) : null,
      requestedAmount: r.requestedAmount != null ? Number(r.requestedAmount) : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null
    }))
  }

  return { summary, breakdown, trend, details }
}

async function runHistoricalReport(
  db: ReportDb,
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  filters: ReturnType<typeof parseQueryParams>,
  groupBy: ReportGroupBy,
  view: ReportViewType,
  trendGranularity: ReportTrendGranularity,
  progressiveStages: Record<string, unknown>[] = []
) {
  const auditMatchConditions: Record<string, unknown>[] = [
    {
      $or: [
        { $eq: ['$targetTenantId', tenantIdObj] },
        { $eq: [{ $toString: '$targetTenantId' }, tenantIdHex] }
      ]
    },
    {
      $or: [
        { $eq: ['$action', 'LEAD_STATUS_CHANGED'] },
        { $eq: ['$metadata.requestedAction', 'LEAD_STATUS_CHANGED'] },
        { $eq: ['$action', 'LEAD_CREATED'] },
        { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
      ]
    }
  ]

  if (filters.stageId) {
    auditMatchConditions.push({
      $or: [
        {
          $and: [
            {
              $or: [
                { $eq: ['$action', 'LEAD_STATUS_CHANGED'] },
                { $eq: ['$metadata.requestedAction', 'LEAD_STATUS_CHANGED'] }
              ]
            },
            {
              $or: [
                { $eq: [{ $toString: '$metadata.toStageId' }, filters.stageId] },
                { $eq: ['$metadata.toStageId', filters.stageId] }
              ]
            }
          ]
        },
        {
          $and: [
            {
              $or: [
                { $eq: ['$action', 'LEAD_CREATED'] },
                { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
              ]
            },
            {
              $or: [
                { $eq: [{ $toString: '$metadata.stageId' }, filters.stageId] },
                { $eq: ['$metadata.stageId', filters.stageId] }
              ]
            }
          ]
        }
      ]
    })
  }

  const stagedDateConditions: Record<string, unknown>[] = [
    { $ne: ['$effectiveStagedDate', null] },
    { $ne: ['$effectiveStagedDate', ''] }
  ]

  if (filters.dateFrom) stagedDateConditions.push({ $gte: ['$effectiveStagedDate', filters.dateFrom] })
  if (filters.dateTo) stagedDateConditions.push({ $lte: ['$effectiveStagedDate', filters.dateTo] })

  const leadRoleFilter =
    role !== 'ADMIN' && role !== 'OWNER'
      ? { $or: [{ createdBy: userId }, { assignedAgentId: userId }] }
      : {}

  const leadDimensionFilter: Record<string, unknown> = { tenantId: tenantIdObj, ...leadRoleFilter }

  if (!filters.showInactive) leadDimensionFilter.isActive = { $ne: false }
  if (filters.assignedAgentId && ObjectId.isValid(filters.assignedAgentId))
    leadDimensionFilter.assignedAgentId = new ObjectId(filters.assignedAgentId)
  if (filters.customerId && ObjectId.isValid(filters.customerId))
    leadDimensionFilter.customerId = new ObjectId(filters.customerId)
  if (filters.loanTypeId && ObjectId.isValid(filters.loanTypeId))
    leadDimensionFilter.loanTypeId = new ObjectId(filters.loanTypeId)
  if (filters.bankName) leadDimensionFilter.bankName = filters.bankName

  const basePipeline: Record<string, unknown>[] = [
    { $match: { $expr: { $and: auditMatchConditions } } },
    { $addFields: { effectiveStagedDate: effectiveStagedDateExpression() } },
    { $match: { $expr: { $and: stagedDateConditions } } },
    {
      $addFields: {
        leadIdObj: {
          $convert: { input: '$metadata.leadId', to: 'objectId', onError: null, onNull: null }
        },
        matchedStageId: {
          $cond: {
            if: {
              $or: [
                { $eq: ['$action', 'LEAD_CREATED'] },
                { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
              ]
            },
            then: '$metadata.stageId',
            else: '$metadata.toStageId'
          }
        },
        matchedStageName: {
          $cond: {
            if: {
              $or: [
                { $eq: ['$action', 'LEAD_CREATED'] },
                { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
              ]
            },
            then: '$metadata.stageName',
            else: '$metadata.toStageName'
          }
        }
      }
    },
    {
      $lookup: {
        from: 'loanCases',
        localField: 'leadIdObj',
        foreignField: '_id',
        as: 'lead'
      }
    },
    { $unwind: '$lead' },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            '$lead',
            {
              auditStagedDate: '$effectiveStagedDate',
              auditStageName: '$matchedStageName',
              auditStageId: '$matchedStageId'
            }
          ]
        }
      }
    },
    { $match: leadDimensionFilter },
    ...progressiveStages
  ]

  const includeBreakdown = view === 'summary' || view === 'full'
  const includeTrend = view === 'trend' || view === 'full'
  const includeDetails = view === 'detailed' || view === 'full'

  const summaryAgg = await db
    .collection('auditLogs')
    .aggregate([
      ...basePipeline,
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$requestedAmount', 0] } },
          customers: { $addToSet: '$customerId' }
        }
      }
    ])
    .toArray()

  const summaryRow = summaryAgg[0] || { totalCases: 0, totalAmount: 0, customers: [] }

  const summary: ReportSummary = {
    totalCases: Number(summaryRow.totalCases || 0),
    totalAmount: Number(summaryRow.totalAmount || 0),
    uniqueCustomers: Array.isArray(summaryRow.customers) ? summaryRow.customers.filter(Boolean).length : 0
  }

  let breakdown: ReportBreakdownRow[] = []
  let trend: ReportTrendRow[] = []
  let details: ReportDetailRow[] = []

  function historicalGroupField() {
    switch (groupBy) {
      case 'agent':
        return '$assignedAgentId'
      case 'customer':
        return '$customerId'
      case 'bank':
        return { $ifNull: ['$bankName', 'Unassigned'] }
      case 'loanType':
        return '$loanTypeId'
      case 'time':
        return '$auditStagedDate'
      case 'stage':
      default:
        return '$auditStageId'
    }
  }

  if (includeBreakdown && groupBy !== 'time') {
    const breakdownRows = await db
      .collection('auditLogs')
      .aggregate([
        ...basePipeline,
        {
          $group: {
            _id: historicalGroupField(),
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$requestedAmount', 0] } },
            stageName: { $first: '$auditStageName' }
          }
        },
        ...(groupBy === 'stage' ? [{ $addFields: { label: { $ifNull: ['$stageName', 'Unknown stage'] } } }] : []),
        ...(groupBy === 'agent'
          ? [
              {
                $lookup: {
                  from: 'users',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { name: 1, email: 1 } }],
                  as: 'agent'
                }
              },
              { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
              {
                $addFields: {
                  label: { $ifNull: ['$agent.name', { $ifNull: ['$agent.email', 'Unassigned'] }] }
                }
              }
            ]
          : []),
        ...(groupBy === 'customer'
          ? [
              {
                $lookup: {
                  from: 'customers',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { fullName: 1 } }],
                  as: 'customer'
                }
              },
              { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
              { $addFields: { label: { $ifNull: ['$customer.fullName', 'Unknown'] } } }
            ]
          : []),
        ...(groupBy === 'loanType'
          ? [
              {
                $lookup: {
                  from: 'loanTypes',
                  localField: '_id',
                  foreignField: '_id',
                  pipeline: [{ $project: { name: 1 } }],
                  as: 'loanType'
                }
              },
              { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
              { $addFields: { label: { $ifNull: ['$loanType.name', 'Unknown'] } } }
            ]
          : []),
        ...(groupBy === 'bank' ? [{ $addFields: { label: '$_id' } }] : []),
        {
          $project: {
            key: { $toString: '$_id' },
            label: 1,
            count: 1,
            amount: 1
          }
        },
        { $sort: { count: -1, label: 1 } }
      ])
      .toArray()

    breakdown = breakdownRows.map(r => ({
      key: r.key ? String(r.key) : 'unknown',
      label: r.label ? String(r.label) : 'Unknown',
      count: Number(r.count || 0),
      amount: Number(r.amount || 0),
      order: null
    }))
  }

  if (includeTrend) {
    const trendField =
      groupBy === 'time' || trendGranularity === 'month'
        ? '$auditStagedDate'
        : '$auditStagedDate'

    const trendRows = await db
      .collection('auditLogs')
      .aggregate([
        ...basePipeline,
        {
          $group: {
            _id: trendField,
            count: { $sum: 1 },
            amount: { $sum: { $ifNull: ['$requestedAmount', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray()

    trend = trendRows.map(r => ({
      label: String(r._id || ''),
      periodStart: String(r._id || ''),
      count: Number(r.count || 0),
      amount: Number(r.amount || 0)
    }))
  }

  if (includeDetails) {
    const detailRows = await db
      .collection('auditLogs')
      .aggregate([
        ...basePipeline,
        { $sort: { auditStagedDate: -1, createdAt: -1 } },
        { $limit: 500 },
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
            from: 'users',
            localField: 'assignedAgentId',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1 } }],
            as: 'agent'
          }
        },
        { $unwind: { path: '$agent', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            leadId: { $toString: '$_id' },
            customerName: '$customer.fullName',
            loanTypeName: '$loanType.name',
            bankName: 1,
            agentName: '$agent.name',
            requestedAmount: 1,
            createdAt: 1,
            auditStagedDate: 1,
            auditStageName: 1
          }
        }
      ])
      .toArray()

    details = detailRows.map(r => ({
      leadId: String(r.leadId),
      customerName: r.customerName ? String(r.customerName) : null,
      loanTypeName: r.loanTypeName ? String(r.loanTypeName) : null,
      bankName: r.bankName != null ? String(r.bankName) : null,
      stageName: r.auditStageName ? String(r.auditStageName) : null,
      agentName: r.agentName ? String(r.agentName) : null,
      requestedAmount: r.requestedAmount != null ? Number(r.requestedAmount) : null,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
      auditStagedDate: r.auditStagedDate ? String(r.auditStagedDate) : null,
      auditStageName: r.auditStageName ? String(r.auditStageName) : null
    }))
  }

  return { summary, breakdown, trend, details }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getReportTenantContext(session as Parameters<typeof getReportTenantContext>[0])

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, tenantIdHex, userId, role } = ctx
  const filters = parseQueryParams(new URL(request.url).searchParams)

  const disclaimer =
    filters.dataMode === 'historical'
      ? 'Historical report: counts reflect stage movements recorded in audit logs during the selected period. A lead may appear multiple times if it moved through multiple stages. Current pipeline position may differ.'
      : null

  let result: { summary: ReportSummary; breakdown: ReportBreakdownRow[]; trend: ReportTrendRow[]; details: ReportDetailRow[] }

  const progressiveStages = filters.progressivePaymentFilter
    ? buildProgressivePaymentFilterStages(tenantIdObj, tenantIdHex, filters.progressivePaymentFilter)
    : []

  if (filters.dataMode === 'historical') {
    result = await runHistoricalReport(
      db,
      tenantIdObj,
      tenantIdHex,
      userId,
      role,
      filters,
      filters.groupBy,
      filters.view,
      filters.trendGranularity,
      progressiveStages
    )
  } else {
    const match = buildSnapshotMatch(tenantIdObj, userId, role, filters)

    result = await runSnapshotReport(
      db,
      match,
      filters.groupBy,
      filters.view,
      filters.trendGranularity,
      progressiveStages
    )
  }

  return NextResponse.json({
    dataMode: filters.dataMode,
    groupBy: filters.groupBy,
    metric: filters.metric,
    view: filters.view,
    disclaimer,
    filtersApplied: filters,
    summary: result.summary,
    breakdown: result.breakdown,
    trend: result.trend,
    details: result.details,
    generatedAt: new Date().toISOString()
  })
}
