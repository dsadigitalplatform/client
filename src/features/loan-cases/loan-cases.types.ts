export type LoanCaseDocumentStatus = 'COLLECTED' | 'SUBMITTED_TO_BANK' | 'APPROVED' | 'PENDING'
export type LeadSource = 'DIRECT' | 'ASSOCIATE'

export type LoanCaseDocument = {
  documentId: string
  documentName: string
  status: LoanCaseDocumentStatus
}

export type LoanCaseListItem = {
  id: string
  customerId: string
  customerName: string
  loanTypeId: string
  loanTypeName: string
  bankName: string | null
  requestedAmount: number | null
  stageId: string
  stageName: string
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
}

export type LoanCaseDetails = {
  id: string
  customerId: string
  customerName: string
  loanTypeId: string
  loanTypeName: string
  bankName: string | null
  requestedAmount: number | null
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
  stageId: string
  stageName: string
  documents: LoanCaseDocument[]
  isLocked: boolean
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type CreateLoanCaseInput = {
  customerId: string
  loanTypeId: string
  stageId: string
  assignedAgentId?: string | null
  leadSource?: LeadSource
  associateId?: string | null
  bankName?: string | null
  requestedAmount: number
  eligibleAmount?: number | null
  interestRate?: number | null
  tenureMonths?: number | null
  emi?: number | null
  allowDuplicate?: boolean
}

export type UpdateLoanCaseInput = Partial<CreateLoanCaseInput> & {
  documents?: Array<{ documentId: string; status: LoanCaseDocumentStatus }>
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
