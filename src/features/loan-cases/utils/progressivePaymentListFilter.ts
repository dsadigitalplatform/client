import type { ObjectId } from 'mongodb'

export type ProgressivePaymentListFilterMode = 'ready_to_track' | 'tracking_active'

function buildTenantMatchExpr(tenantIdObj: ObjectId, tenantIdHex: string) {
  return {
    $or: [
      { $eq: ['$tenantId', tenantIdObj] },
      { $eq: [{ $toString: '$tenantId' }, tenantIdHex] }
    ]
  }
}

function buildLeadMatchExpr() {
  return {
    $or: [
      { $eq: ['$leadId', '$$leadId'] },
      { $eq: [{ $toString: '$leadId' }, { $toString: '$$leadId' }] }
    ]
  }
}

export function buildDisbursementTrackerLookupStage(tenantIdObj: ObjectId, tenantIdHex: string) {
  return {
    $lookup: {
      from: 'loanDisbursementTrackers',
      let: { leadId: '$_id' },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [buildTenantMatchExpr(tenantIdObj, tenantIdHex), buildLeadMatchExpr()]
            }
          }
        },
        { $limit: 1 },
        { $project: { _id: 1 } }
      ],
      as: 'disbursementTrackerMatch'
    }
  }
}

/** Progressive payment enabled on lead; no disbursement tracker yet. */
export function buildProgressivePaymentReadyToTrackMatchStage() {
  return {
    $match: {
      enableProgressivePayment: true,
      $expr: {
        $eq: [{ $size: { $ifNull: ['$disbursementTrackerMatch', []] } }, 0]
      }
    }
  }
}

/** Progressive payment enabled and disbursement tracker exists. */
export function buildProgressivePaymentTrackingActiveMatchStage() {
  return {
    $match: {
      enableProgressivePayment: true,
      $expr: {
        $gt: [{ $size: { $ifNull: ['$disbursementTrackerMatch', []] } }, 0]
      }
    }
  }
}

export function isProgressivePaymentListFilterMode(value: string): value is ProgressivePaymentListFilterMode {
  return value === 'ready_to_track' || value === 'tracking_active'
}
