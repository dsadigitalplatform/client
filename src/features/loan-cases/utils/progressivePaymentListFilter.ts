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

/** Lookup tracker money/status fields for report detail rows (preserve null when absent). */
export function buildDisbursementTrackerDetailsLookupStages(tenantIdObj: ObjectId, tenantIdHex: string) {
  return [
    {
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
          {
            $project: {
              approvedAmount: 1,
              totalDisbursedAmount: 1,
              remainingAmount: 1,
              disbursementStatus: 1
            }
          }
        ],
        as: 'disbursementTracker'
      }
    },
    { $unwind: { path: '$disbursementTracker', preserveNullAndEmptyArrays: true } }
  ]
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

export function buildProgressivePaymentFilterStages(
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  mode: ProgressivePaymentListFilterMode
) {
  return [
    buildDisbursementTrackerLookupStage(tenantIdObj, tenantIdHex),
    mode === 'ready_to_track'
      ? buildProgressivePaymentReadyToTrackMatchStage()
      : buildProgressivePaymentTrackingActiveMatchStage()
  ]
}
