import type { ObjectId } from 'mongodb'

import { parseStageSubmittedDate } from '@features/loan-cases/utils/stageSubmittedDate'

const STAGE_AUDIT_TIMEZONE = 'Asia/Kolkata'

export function effectiveStagedDateFromAuditEntry(
  metadata: Record<string, unknown> | null | undefined,
  createdAt: Date | string | null | undefined
): string | null {
  const submitted = parseStageSubmittedDate(metadata?.stageSubmittedDate)

  if (submitted) return submitted.isoDate

  if (!createdAt) return null

  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)

  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-CA', { timeZone: STAGE_AUDIT_TIMEZONE }).format(date)
}

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

function buildTenantMatchExpr(tenantIdObj: ObjectId, tenantIdHex: string) {
  return {
    $or: [
      { $eq: ['$targetTenantId', tenantIdObj] },
      { $eq: [{ $toString: '$targetTenantId' }, tenantIdHex] }
    ]
  }
}

function buildLeadMatchExpr() {
  return {
    $or: [
      { $eq: [{ $toString: '$metadata.leadId' }, '$$leadId'] },
      { $eq: ['$metadata.leadId', '$$leadId'] },
      {
        $eq: [
          { $convert: { input: '$metadata.leadId', to: 'objectId', onError: null, onNull: null } },
          { $convert: { input: '$$leadId', to: 'objectId', onError: null, onNull: null } }
        ]
      }
    ]
  }
}

function buildStageActionMatchExpr() {
  return {
    $or: [
      { $eq: ['$action', 'LEAD_STATUS_CHANGED'] },
      { $eq: ['$metadata.requestedAction', 'LEAD_STATUS_CHANGED'] },
      { $eq: ['$action', 'LEAD_CREATED'] },
      { $eq: ['$metadata.requestedAction', 'LEAD_CREATED'] }
    ]
  }
}

function buildTargetStageMatchExpr(stageId: string) {
  return {
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
}

function buildStagedDateRangeExpr(stagedDateFrom?: string, stagedDateTo?: string) {
  const conditions: Record<string, unknown>[] = [
    { $ne: ['$effectiveStagedDate', null] },
    { $ne: ['$effectiveStagedDate', ''] }
  ]

  if (stagedDateFrom) conditions.push({ $gte: ['$effectiveStagedDate', stagedDateFrom] })
  if (stagedDateTo) conditions.push({ $lte: ['$effectiveStagedDate', stagedDateTo] })

  return { $and: conditions }
}

export function buildStagedDateAuditLookupStage(
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  stagedDateFrom?: string,
  stagedDateTo?: string,
  stageId?: string
) {
  const matchConditions: Record<string, unknown>[] = [
    buildTenantMatchExpr(tenantIdObj, tenantIdHex),
    buildLeadMatchExpr(),
    buildStageActionMatchExpr()
  ]

  if (stageId) {
    matchConditions.push(buildTargetStageMatchExpr(stageId))
  }

  const pipeline: Record<string, unknown>[] = [
    {
      $match: {
        $expr: {
          $and: matchConditions
        }
      }
    },
    {
      $addFields: {
        effectiveStagedDate: effectiveStagedDateExpression()
      }
    },
    {
      $match: {
        $expr: buildStagedDateRangeExpr(stagedDateFrom, stagedDateTo)
      }
    },
    {
      $addFields: {
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
    { $sort: { effectiveStagedDate: -1, createdAt: -1 } },
    { $limit: 1 },
    {
      $project: {
        _id: 1,
        effectiveStagedDate: 1,
        matchedStageId: 1,
        matchedStageName: 1
      }
    }
  ]

  return {
    $lookup: {
      from: 'auditLogs',
      let: { leadId: { $toString: '$_id' } },
      pipeline,
      as: 'stagedDateAudits'
    }
  }
}

export function buildStagedDateAuditExistsMatchStage() {
  return {
    $match: {
      $expr: {
        $gt: [{ $size: { $ifNull: ['$stagedDateAudits', []] } }, 0]
      }
    }
  }
}

/** Flattens the first staged-date audit match onto the lead document for list projection. */
export function buildStagedDateAuditFlattenStage() {
  return {
    $addFields: {
      auditMatch: { $arrayElemAt: ['$stagedDateAudits', 0] }
    }
  }
}
