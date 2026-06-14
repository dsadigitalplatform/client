import { ObjectId, type Db } from 'mongodb'

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

export async function getHistoricalStageSummary(
  db: Db,
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  stageId: string,
  dateFrom: string,
  dateTo: string,
  assignedAgentId?: string | null
): Promise<{ totalCases: number; totalAmount: number }> {
  const auditMatchConditions: Record<string, unknown>[] = [
    {
      $or: [{ $eq: ['$targetTenantId', tenantIdObj] }, { $eq: [{ $toString: '$targetTenantId' }, tenantIdHex] }]
    },
    {
      $or: [
        { $eq: ['$action', 'LEAD_STATUS_CHANGED'] },
        { $eq: ['$metadata.requestedAction', 'LEAD_STATUS_CHANGED'] },
        { $eq: ['$action', 'LEAD_CREATED'] },
        { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
      ]
    },
    {
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
                { $eq: [{ $toString: '$metadata.toStageId' }, stageId] },
                { $eq: ['$metadata.toStageId', stageId] }
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
                { $eq: [{ $toString: '$metadata.stageId' }, stageId] },
                { $eq: ['$metadata.stageId', stageId] }
              ]
            }
          ]
        }
      ]
    }
  ]

  const stagedDateConditions: Record<string, unknown>[] = [
    { $ne: ['$effectiveStagedDate', null] },
    { $ne: ['$effectiveStagedDate', ''] },
    { $gte: ['$effectiveStagedDate', dateFrom] },
    { $lte: ['$effectiveStagedDate', dateTo] }
  ]

  const leadRoleFilter =
    role !== 'ADMIN' && role !== 'OWNER'
      ? { $or: [{ createdBy: userId }, { assignedAgentId: userId }] }
      : {}

  const leadDimensionFilter: Record<string, unknown> = { tenantId: tenantIdObj, ...leadRoleFilter, isActive: { $ne: false } }

  if (assignedAgentId && ObjectId.isValid(assignedAgentId)) {
    leadDimensionFilter.assignedAgentId = new ObjectId(assignedAgentId)
  }

  const summaryAgg = await db
    .collection('auditLogs')
    .aggregate([
      { $match: { $expr: { $and: auditMatchConditions } } },
      { $addFields: { effectiveStagedDate: effectiveStagedDateExpression() } },
      { $match: { $expr: { $and: stagedDateConditions } } },
      {
        $addFields: {
          leadIdObj: {
            $convert: { input: '$metadata.leadId', to: 'objectId', onError: null, onNull: null }
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
      { $replaceRoot: { newRoot: '$lead' } },
      { $match: leadDimensionFilter },
      {
        $group: {
          _id: null,
          totalCases: { $sum: 1 },
          totalAmount: { $sum: { $ifNull: ['$requestedAmount', 0] } }
        }
      }
    ])
    .toArray()

  const row = summaryAgg[0] || { totalCases: 0, totalAmount: 0 }

  return {
    totalCases: Number(row.totalCases || 0),
    totalAmount: Number(row.totalAmount || 0)
  }
}
