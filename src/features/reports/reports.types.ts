export type ReportDataMode = 'snapshot' | 'historical'

export type ReportGroupBy = 'stage' | 'agent' | 'customer' | 'bank' | 'loanType' | 'time'

export type ReportMetric = 'count' | 'amount'

export type ReportViewType = 'summary' | 'detailed' | 'trend' | 'full'

export type ReportTrendGranularity = 'week' | 'month'

export type ReportPresetId = 'stage-wise-loans' | 'agent-wise-loans' | 'bank-wise-loans' | 'loan-wise-loans'

export type ReportDetailGroupDimension = Exclude<ReportGroupBy, 'time'>

export type ReportProgressivePaymentFilter = 'ready_to_track' | 'tracking_active'

export type ReportFilters = {
  dataMode: ReportDataMode
  groupBy: ReportGroupBy
  /** Second nesting level for the detailed table (e.g. agent → stage). */
  groupBySecondary: ReportDetailGroupDimension | null
  view: ReportViewType
  metric: ReportMetric
  trendGranularity: ReportTrendGranularity
  dateFrom: string | null
  dateTo: string | null
  stageId: string | null
  /** When set, historical reports include audit records for all listed stages. */
  stageIds: string[] | null
  assignedAgentId: string | null
  customerId: string | null
  loanTypeId: string | null
  bankName: string | null
  showInactive: boolean
  progressivePaymentFilter: ReportProgressivePaymentFilter | null
  /** Include leads with progressive disbursement line items in the date range. */
  includeDisbursementActivityInRange: boolean
}

export type ReportBreakdownRow = {
  key: string
  label: string
  count: number
  amount: number
  order?: number | null
}

export type ReportTrendRow = {
  label: string
  periodStart: string
  count: number
  amount: number
}

export type ReportDisbursementStatus = 'PENDING' | 'PARTIAL' | 'COMPLETED'

export type ReportDetailRow = {
  leadId: string
  leadCode: string | null
  customerName: string | null
  loanTypeName: string | null
  bankName: string | null
  stageName: string | null
  agentName: string | null
  requestedAmount: number | null
  createdAt: string | null

  /** Historical mode: when the lead reached this stage per audit */
  auditStagedDate?: string | null
  auditStageName?: string | null

  /** Present when a progressive disbursement tracker exists for the lead */
  disbursementStatus?: ReportDisbursementStatus | null
  totalDisbursedAmount?: number | null
  remainingAmount?: number | null
  progressPercent?: number | null
  trackerApprovedAmount?: number | null
}

export type ReportSummary = {
  totalCases: number
  totalAmount: number
  uniqueCustomers: number

  /** Deduped tracker metrics from detail rows (when any trackers exist) */
  disbursementTrackedCases?: number
  totalDisbursedAmount?: number
  totalRemainingAmount?: number
  disbursementPending?: number
  disbursementPartial?: number
  disbursementCompleted?: number
}

export type ReportQueryResponse = {
  dataMode: ReportDataMode
  groupBy: ReportGroupBy
  metric: ReportMetric
  view: ReportViewType
  disclaimer: string | null
  filtersApplied: Partial<ReportFilters>
  summary: ReportSummary
  breakdown: ReportBreakdownRow[]
  trend: ReportTrendRow[]
  details: ReportDetailRow[]
  generatedAt: string
}

export type ReportFilterOptions = {
  stages: Array<{
    id: string
    name: string
    order: number
    isLoggedIn?: boolean
    isDisbursed?: boolean
    isClosed?: boolean
    isRejected?: boolean
  }>
  agents: Array<{ id: string; name: string | null; email: string | null }>
  customers: Array<{ id: string; name: string }>
  loanTypes: Array<{ id: string; name: string }>
  banks: Array<{ name: string }>
}

export type ReportDetailExportFormat = 'grouped' | 'flat'

export type ReportExportMeta = {
  organisationName: string
  preparedBy: string
  preparedAt: string
  reportTitle: string
  dataMode: ReportDataMode
  disclaimer: string | null
  groupBySecondary?: ReportDetailGroupDimension | null
  detailFormat?: ReportDetailExportFormat
}

export type ReportPreset = {
  id: ReportPresetId
  title: string
  description: string
  icon: string
  filters: Partial<ReportFilters>
}

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  dataMode: 'snapshot',
  groupBy: 'stage',
  groupBySecondary: 'agent',
  view: 'full',
  metric: 'count',
  trendGranularity: 'week',
  dateFrom: null,
  dateTo: null,
  stageId: null,
  stageIds: null,
  assignedAgentId: null,
  customerId: null,
  loanTypeId: null,
  bankName: null,
  showInactive: false,
  progressivePaymentFilter: null,
  includeDisbursementActivityInRange: false
}

export function filtersEqual(a: ReportFilters, b: ReportFilters) {
  return (Object.keys(DEFAULT_REPORT_FILTERS) as Array<keyof ReportFilters>).every(key => {
    if (key === 'stageIds') {
      const aIds = a.stageIds ?? []
      const bIds = b.stageIds ?? []

      if (aIds.length !== bIds.length) return false

      const sortedA = [...aIds].sort()
      const sortedB = [...bIds].sort()

      return sortedA.every((id, index) => id === sortedB[index])
    }

    return a[key] === b[key]
  })
}

export function hasActiveDimensionFilters(filters: ReportFilters) {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.stageId ||
      (filters.stageIds && filters.stageIds.length > 0) ||
      filters.assignedAgentId ||
      filters.customerId ||
      filters.loanTypeId ||
      filters.bankName ||
      filters.showInactive ||
      filters.progressivePaymentFilter ||
      filters.includeDisbursementActivityInRange
  )
}

export const REPORT_PRESETS: ReportPreset[] = [
  {
    id: 'stage-wise-loans',
    title: 'Stage-wise Loans',
    description: 'Current pipeline breakdown by lead stage with counts and amounts.',
    icon: 'ri-stack-line',
    filters: {
      dataMode: 'snapshot',
      groupBy: 'stage',
      groupBySecondary: 'agent',
      view: 'full',
      metric: 'count'
    }
  },
  {
    id: 'agent-wise-loans',
    title: 'Agent-wise Performance',
    description: 'Loan cases and volume grouped by assigned agent.',
    icon: 'ri-team-line',
    filters: {
      dataMode: 'snapshot',
      groupBy: 'agent',
      groupBySecondary: 'stage',
      view: 'full',
      metric: 'amount'
    }
  },
  {
    id: 'bank-wise-loans',
    title: 'Bank-wise Distribution',
    description: 'See how leads are distributed across partner banks.',
    icon: 'ri-bank-line',
    filters: {
      dataMode: 'snapshot',
      groupBy: 'bank',
      view: 'full',
      metric: 'count'
    }
  },
  {
    id: 'loan-wise-loans',
    title: 'Loan-wise Distribution',
    description: 'See how leads are distributed across loan types.',
    icon: 'ri-file-list-3-line',
    filters: {
      dataMode: 'snapshot',
      groupBy: 'loanType',
      groupBySecondary: 'bank',
      view: 'full',
      metric: 'count'
    }
  }
]

export function showsLoanTypeDetailColumn(
  groupBy: ReportGroupBy,
  groupBySecondary?: ReportDetailGroupDimension | null
) {
  return groupBy !== 'loanType' && groupBySecondary !== 'loanType'
}
