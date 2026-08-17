export type LoanStatusStage = {
  id: string
  name: string
  description: string | null
  order: number
  isLoggedIn?: boolean
  isDisbursed?: boolean
  isClosed?: boolean
  isRejected?: boolean
  createdAt: string | null
  canManage?: boolean
}

