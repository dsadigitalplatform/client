export type DisbursementStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED'

export function computeDisbursementStatus(approvedAmount: number, totalDisbursedAmount: number): DisbursementStatus {
  if (totalDisbursedAmount <= 0) return 'PENDING'
  if (totalDisbursedAmount >= approvedAmount) return 'COMPLETED'

  return 'PARTIAL'
}

export function computeRemainingAmount(approvedAmount: number, totalDisbursedAmount: number) {
  return Math.max(0, approvedAmount - totalDisbursedAmount)
}

export function computeProgressPercent(approvedAmount: number, totalDisbursedAmount: number) {
  if (approvedAmount <= 0) return 0

  return Math.min(100, Math.round((totalDisbursedAmount / approvedAmount) * 100))
}

export function resolveApprovedAmount(lead: {
  approvedAmount?: number | null
  requestedAmount?: number | null
}) {
  const approved = lead.approvedAmount
  const requested = lead.requestedAmount

  if (typeof approved === 'number' && approved > 0) return approved
  if (typeof requested === 'number' && requested > 0) return requested

  return null
}
