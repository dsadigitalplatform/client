export type LoanCaseDocumentStatus = 'COLLECTED' | 'SUBMITTED_TO_BANK' | 'APPROVED' | 'PENDING'
export type LeadSource = 'DIRECT' | 'ASSOCIATE' | 'ADVOCATE'

export type LoanCaseDocument = {
  documentId: string
  documentName: string
  status: LoanCaseDocumentStatus
}

export type LoanCaseRemark = {
  text: string
  updatedByUserId: string | null
  updatedByName: string | null
  updatedByEmail: string | null
  updatedAt: string | null
}

export type LoanCaseListItem = {
  id: string
  customerId: string
  customerName: string
  loanTypeId: string
  loanTypeName: string
  bankName: string | null
  corporateId: string | null
  corporateName: string | null
  corporateCode: string | null
  requestedAmount: number | null
  stageId: string
  stageName: string
  /** Present when list is filtered by staged date via audit history. */
  auditMatchedStageName?: string | null
  auditMatchedStagedDate?: string | null
  assignedAgentId: string | null
  assignedAgentName: string | null
  assignedAgentEmail: string | null
  updatedAt: string | null
  isLocked?: boolean
  isActive?: boolean
  totalDocuments?: number
  incompleteDocumentsCount?: number
  pendingDocumentsCount?: number
  hasIncompleteDocuments?: boolean
  canMoveStage?: boolean
  remarks?: LoanCaseRemark[]
  enableProgressivePayment?: boolean
}

export type LeadDisbursementTrackerSummary = {
  id: string
  approvedAmount: number
  totalDisbursedAmount: number
  remainingAmount: number
  disbursementStatus: 'PENDING' | 'PARTIAL' | 'COMPLETED'
  progressPercent: number
  disbursementCount: number
}

export type LoanCaseDetails = {
  id: string
  customerId: string
  customerName: string
  loanTypeId: string
  loanTypeName: string
  bankName: string | null
  corporateId: string | null
  corporateName: string | null
  corporateCode: string | null
  requestedAmount: number | null
  approvedAmount: number | null
  eligibleAmount: number | null
  interestRate: number | null
  tenureMonths: number | null
  emi: number | null
  assignedAgentId: string | null
  assignedAgentName: string | null
  assignedAgentEmail: string | null
  leadSource: LeadSource
  associateId: string | null
  associateName: string | null
  associateCode: string | null
  advocateId: string | null
  advocateName: string | null
  advocateMobile: string | null
  stageId: string
  stageName: string
  /** Current stage submission date (YYYY-MM-DD) from audit history. */
  stageSubmittedDate?: string | null
  documents: LoanCaseDocument[]
  isLocked: boolean
  isActive: boolean
  enableProgressivePayment: boolean
  disbursementTracker: LeadDisbursementTrackerSummary | null
  createdAt: string | null
  updatedAt: string | null
  remarks?: LoanCaseRemark[]
}

export type CreateLoanCaseInput = {
  customerId: string
  loanTypeId: string
  stageId: string
  /** User-entered date when the stage was submitted (YYYY-MM-DD). */
  stageSubmittedDate: string
  assignedAgentId?: string | null
  leadSource?: LeadSource
  associateId?: string | null
  advocateId?: string | null
  bankName?: string | null
  corporateId?: string | null
  requestedAmount: number
  approvedAmount?: number | null
  eligibleAmount?: number | null
  interestRate?: number | null
  tenureMonths?: number | null
  emi?: number | null
  enableProgressivePayment?: boolean
  allowDuplicate?: boolean
}

export type UpdateLoanCaseInput = Partial<CreateLoanCaseInput> & {
  documents?: Array<{ documentId: string; status: LoanCaseDocumentStatus }>
  remarkToAdd?: string
}

export type TenantUserOption = {
  id: string
  name: string
  email: string | null
}

export type LeadAuditHistoryChange = {
  label: string
  from: string | null
  to: string | null
  value: string | null
}

export type LeadAuditHistoryItem = {
  id: string
  action: string
  actionLabel: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  createdAt: string | null
  changes: LeadAuditHistoryChange[]
}
