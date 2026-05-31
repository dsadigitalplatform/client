export type DisbursementStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED'

export type DisbursementTrackerListItem = {
  id: string
  leadId: string
  customerName: string
  loanTypeName: string
  stageName: string
  bankName: string | null
  assignedAgentId: string | null
  assignedAgentName: string | null
  approvedAmount: number
  totalDisbursedAmount: number
  remainingAmount: number
  disbursementStatus: DisbursementStatus
  progressPercent: number
  disbursementCount: number
  createdByName: string
  createdAt: string | null
  updatedAt: string | null
}

export type EligibleLeadItem = {
  id: string
  customerId: string
  customerName: string
  loanTypeName: string
  stageName: string
  bankName: string | null
  requestedAmount: number | null
  approvedAmount: number | null
  resolvedApprovedAmount: number | null
  assignedAgentName: string | null
  updatedAt: string | null
}

export type LoanDisbursementLineItem = {
  id: string
  amount: number
  disbursedDate: string
  reason: string
  bankReference: string | null
  createdByUserId: string
  createdByName: string
  createdAt: string | null
}

export type DisbursementTrackerDetails = {
  id: string
  leadId: string
  customerId: string
  customerName: string
  loanTypeName: string
  stageName: string
  bankName: string | null
  approvedAmount: number
  totalDisbursedAmount: number
  remainingAmount: number
  disbursementStatus: DisbursementStatus
  progressPercent: number
  createdByUserId: string
  createdByName: string
  createdAt: string | null
  updatedAt: string | null
  disbursements: LoanDisbursementLineItem[]
}

export type DisbursementAuditHistoryChange = {
  label: string
  from: string | null
  to: string | null
  value: string | null
}

export type DisbursementAuditHistoryItem = {
  id: string
  action: string
  actionLabel: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  createdAt: string | null
  changes: DisbursementAuditHistoryChange[]
}

export type CreateDisbursementTrackerInput = {
  leadId: string
}

export type AddLoanDisbursementInput = {
  amount: number
  disbursedDate: string
  reason: string
  bankReference?: string | null
}
