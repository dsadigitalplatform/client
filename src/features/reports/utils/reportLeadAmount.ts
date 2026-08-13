import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'

export function resolveReportLeadAmount(lead: {
  approvedAmount?: number | null
  requestedAmount?: number | null
}) {
  return resolveApprovedAmount(lead)
}

/** Mongo expression: approved amount when set, otherwise requested amount. */
export function reportLeadAmountMongoExpression() {
  return {
    $cond: {
      if: {
        $and: [{ $ne: ['$approvedAmount', null] }, { $gt: ['$approvedAmount', 0] }]
      },
      then: '$approvedAmount',
      else: {
        $cond: {
          if: {
            $and: [{ $ne: ['$requestedAmount', null] }, { $gt: ['$requestedAmount', 0] }]
          },
          then: '$requestedAmount',
          else: 0
        }
      }
    }
  }
}
