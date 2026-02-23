export type LoanType = {
  id: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string | null
  checklistCount?: number
}

export type LoanTypeDocumentStatus = 'REQUIRED' | 'OPTIONAL' | 'INACTIVE'

export type LoanTypeDocumentMapping = {
  documentId: string
  status: LoanTypeDocumentStatus
}

export type LoanTypeDocumentItem = {
  id: string
  name: string
  description: string | null
  isActive: boolean
}
