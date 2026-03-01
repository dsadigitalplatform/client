export type TrendPoint = {
  label: string
  value: number
}

export type LoanCasesTrendPoint = {
  label: string
  count: number
  requestedLoanVolume: number
}

export type DashboardOverview = {
  customers: {
    total: number
    trend: TrendPoint[]
  }
  loanCases: {
    total: number
    requestedLoanVolume: number
    trend: LoanCasesTrendPoint[]
    byStage: Array<{ stageId: string | null; stageName: string; count: number }>
  }
  agents: null | {
    top: Array<{
      id: string
      name: string | null
      email: string | null
      totalCases: number
      requestedLoanVolume: number
    }>
  }
}

export type DashboardWidgetId =
  | 'kpi-customers'
  | 'kpi-cases'
  | 'kpi-loan-volume'
  | 'kpi-conversion'
  | 'stage-breakdown'
  | 'trend-cases'
  | 'trend-loan-volume'
  | 'agents'
  | 'appointments'

export type DashboardGridItem = {
  i: DashboardWidgetId
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
  static?: boolean
}

export type DashboardGridLayouts = Partial<Record<'lg' | 'md' | 'sm' | 'xs', DashboardGridItem[]>>
