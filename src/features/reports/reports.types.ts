export type ReportDataMode = 'snapshot' | 'historical'

export type ReportGroupBy = 'stage' | 'agent' | 'customer' | 'bank' | 'loanType' | 'time'

export type ReportMetric = 'count' | 'amount'

export type ReportViewType = 'summary' | 'detailed' | 'trend' | 'full'

export type ReportTrendGranularity = 'week' | 'month'

export type ReportPresetId =
  | 'stage-wise-loans'
  | 'agent-wise-loans'
  | 'bank-wise-loans'
  | 'loan-type-breakdown'
  | 'stage-movement-history'

export type ReportDetailGroupDimension = Exclude<ReportGroupBy, 'time'>

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
  assignedAgentId: string | null
  customerId: string | null
  loanTypeId: string | null
  bankName: string | null
  showInactive: boolean
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

export type ReportDetailRow = {
  leadId: string
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
}

export type ReportSummary = {
  totalCases: number
  totalAmount: number
  uniqueCustomers: number
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
  stages: Array<{ id: string; name: string; order: number }>
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
  assignedAgentId: null,
  customerId: null,
  loanTypeId: null,
  bankName: null,
  showInactive: false
}

export function filtersEqual(a: ReportFilters, b: ReportFilters) {
  return (Object.keys(DEFAULT_REPORT_FILTERS) as Array<keyof ReportFilters>).every(key => a[key] === b[key])
}

export function hasActiveDimensionFilters(filters: ReportFilters) {
  return Boolean(
    filters.dateFrom ||
      filters.dateTo ||
      filters.stageId ||
      filters.assignedAgentId ||
      filters.customerId ||
      filters.loanTypeId ||
      filters.bankName ||
      filters.showInactive
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
    id: 'loan-type-breakdown',
    title: 'Loan Type Breakdown',
    description: 'Compare product mix by loan type.',
    icon: 'ri-pie-chart-2-line',
    filters: {
      dataMode: 'snapshot',
      groupBy: 'loanType',
      view: 'full',
      metric: 'count'
    }
  },
  {
    id: 'stage-movement-history',
    title: 'Stage Movement History',
    description: 'Audit-based report: leads that reached stages in the selected period.',
    icon: 'ri-history-line',
    filters: {
      dataMode: 'historical',
      groupBy: 'stage',
      view: 'full',
      metric: 'count'
    }
  }
]

export const DATA_MODE_LABELS: Record<ReportDataMode, { title: string; description: string }> = {
  snapshot: {
    title: 'Current snapshot',
    description: 'Shows leads in their current state. Date filters apply to lead creation date.'
  },
  historical: {
    title: 'Stage history (audit)',
    description:
      'Based on audit logs when leads moved into stages. Date filters apply to the staged date recorded in audit history, not the current stage.'
  }
}
