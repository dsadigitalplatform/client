import type { ReportFilterOptions, ReportFilters } from '../reports.types'
import { DEFAULT_REPORT_FILTERS } from '../reports.types'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function getCurrentMonthDateRange(now = new Date()) {
  return {
    dateFrom: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-01`,
    dateTo: formatDateInput(now)
  }
}

export function findLoggedInStageIds(stages: ReportFilterOptions['stages']) {
  const flagged = stages.filter(s => s.isLoggedIn).map(s => s.id)

  if (flagged.length > 0) return flagged

  return stages.filter(s => /logged\s*in/i.test(s.name)).map(s => s.id)
}

export function findLoggedInStageId(stages: ReportFilterOptions['stages']) {
  const ids = findLoggedInStageIds(stages)

  return ids[0] ?? null
}

export function findDisbursedStageId(stages: ReportFilterOptions['stages']) {
  const flagged = stages.find(s => s.isDisbursed)
  if (flagged) return flagged.id

  const byName = stages.find(s => /disburs/i.test(s.name))

  return byName?.id ?? null
}

function sameSortedIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false

  const sortedA = [...a].sort()
  const sortedB = [...b].sort()

  return sortedA.every((id, index) => id === sortedB[index])
}

export function buildMonthlyStageReportFilters(
  stageIds: string | string[],
  overrides: Partial<ReportFilters> = {}
): ReportFilters {
  const { dateFrom, dateTo } = getCurrentMonthDateRange()
  const ids = (Array.isArray(stageIds) ? stageIds : [stageIds]).filter(Boolean)

  const stageFilter =
    ids.length <= 1
      ? { stageId: ids[0] ?? null, stageIds: null }
      : { stageId: null, stageIds: ids }

  return {
    ...DEFAULT_REPORT_FILTERS,
    dataMode: 'historical',
    groupBy: 'agent',
    groupBySecondary: 'stage',
    view: 'full',
    metric: 'count',
    dateFrom,
    dateTo,
    ...stageFilter,
    ...overrides
  }
}

export function buildMonthlyDisbursedReportFilters(
  stages: ReportFilterOptions['stages'],
  overrides: Partial<ReportFilters> = {}
): ReportFilters {
  const disbursedStageId = findDisbursedStageId(stages)
  const { dateFrom, dateTo } = getCurrentMonthDateRange()

  if (!disbursedStageId) {
    return {
      ...DEFAULT_REPORT_FILTERS,
      dataMode: 'historical',
      groupBy: 'agent',
      groupBySecondary: 'stage',
      view: 'full',
      metric: 'count',
      dateFrom,
      dateTo,
      stageId: null,
      stageIds: null,
      includeDisbursementActivityInRange: true,
      ...overrides
    }
  }

  return {
    ...buildMonthlyStageReportFilters(disbursedStageId),
    includeDisbursementActivityInRange: true,
    ...overrides
  }
}

export function buildDefaultMonthlyLoggedInFilters(stages: ReportFilterOptions['stages']) {
  const stageIds = findLoggedInStageIds(stages)

  return stageIds.length > 0 ? buildMonthlyStageReportFilters(stageIds) : null
}

function resolveActiveStageIds(filters: ReportFilters) {
  if (filters.stageIds && filters.stageIds.length > 0) return filters.stageIds
  if (filters.stageId) return [filters.stageId]

  return []
}

function matchesMonthlyStageReport(
  filters: ReportFilters,
  stageIds: string[],
  now = new Date()
) {
  if (stageIds.length === 0) return false

  const { dateFrom, dateTo } = getCurrentMonthDateRange(now)
  const activeStageIds = resolveActiveStageIds(filters)

  return (
    filters.dataMode === 'historical' &&
    sameSortedIds(activeStageIds, stageIds) &&
    filters.dateFrom === dateFrom &&
    filters.dateTo === dateTo
  )
}

export function isMonthlyLoggedInFilters(
  filters: ReportFilters,
  stages: ReportFilterOptions['stages'],
  now = new Date()
) {
  return matchesMonthlyStageReport(filters, findLoggedInStageIds(stages), now)
}

export function isMonthlyDisbursedFilters(
  filters: ReportFilters,
  stages: ReportFilterOptions['stages'],
  now = new Date()
) {
  if (!filters.includeDisbursementActivityInRange) return false

  const disbursedStageId = findDisbursedStageId(stages)
  const { dateFrom, dateTo } = getCurrentMonthDateRange(now)

  if (filters.dataMode !== 'historical') return false
  if (filters.dateFrom !== dateFrom || filters.dateTo !== dateTo) return false

  if (!disbursedStageId) {
    return !filters.stageId && !(filters.stageIds && filters.stageIds.length > 0)
  }

  return matchesMonthlyStageReport(filters, [disbursedStageId], now)
}
