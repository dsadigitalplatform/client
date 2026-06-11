import type { ReportFilterOptions, ReportFilters, ReportQueryResponse } from '../reports.types'

function buildQueryString(filters: ReportFilters) {
  const params = new URLSearchParams()

  params.set('dataMode', filters.dataMode)
  params.set('groupBy', filters.groupBy)
  params.set('view', filters.view)
  params.set('metric', filters.metric)
  params.set('trendGranularity', filters.trendGranularity)
  params.set('showInactive', String(filters.showInactive))

  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.stageId) params.set('stageId', filters.stageId)
  if (filters.assignedAgentId) params.set('assignedAgentId', filters.assignedAgentId)
  if (filters.customerId) params.set('customerId', filters.customerId)
  if (filters.loanTypeId) params.set('loanTypeId', filters.loanTypeId)
  if (filters.bankName) params.set('bankName', filters.bankName)

  return params.toString()
}

export async function fetchReportQuery(filters: ReportFilters): Promise<ReportQueryResponse> {
  const qs = buildQueryString(filters)
  const res = await fetch(`/api/reports/query?${qs}`, { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch report (${res.status})`)
  }

  return res.json()
}

export async function fetchReportFilterOptions(): Promise<ReportFilterOptions> {
  const res = await fetch('/api/reports/filter-options', { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch filter options (${res.status})`)
  }

  return res.json()
}

export async function fetchSessionTenant() {
  const res = await fetch('/api/session/tenant', { cache: 'no-store' })

  if (!res.ok) return null

  return res.json()
}

export async function fetchProfileName() {
  const res = await fetch('/api/profile', { cache: 'no-store' })

  if (!res.ok) return null

  const data = await res.json().catch(() => ({}))

  return data?.profile?.name ? String(data.profile.name) : null
}
