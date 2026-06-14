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

export function findLoggedInStageId(stages: ReportFilterOptions['stages']) {
  const flagged = stages.find(s => s.isLoggedIn)
  if (flagged) return flagged.id

  const byName = stages.find(s => /logged\s*in/i.test(s.name))

  return byName?.id ?? null
}

export function findDisbursedStageId(stages: ReportFilterOptions['stages']) {
  const flagged = stages.find(s => s.isDisbursed)
  if (flagged) return flagged.id

  const byName = stages.find(s => /disburs/i.test(s.name))

  return byName?.id ?? null
}

export function buildMonthlyStageReportFilters(
  stageId: string,
  overrides: Partial<ReportFilters> = {}
): ReportFilters {
  const { dateFrom, dateTo } = getCurrentMonthDateRange()

  return {
    ...DEFAULT_REPORT_FILTERS,
    dataMode: 'historical',
    groupBy: 'agent',
    groupBySecondary: 'stage',
    view: 'full',
    metric: 'count',
    dateFrom,
    dateTo,
    stageId,
    ...overrides
  }
}

export function buildDefaultMonthlyLoggedInFilters(stages: ReportFilterOptions['stages']) {
  const stageId = findLoggedInStageId(stages)

  return stageId ? buildMonthlyStageReportFilters(stageId) : null
}

function matchesMonthlyStageReport(
  filters: ReportFilters,
  stageId: string | null,
  now = new Date()
) {
  if (!stageId) return false

  const { dateFrom, dateTo } = getCurrentMonthDateRange(now)

  return (
    filters.dataMode === 'historical' &&
    filters.stageId === stageId &&
    filters.dateFrom === dateFrom &&
    filters.dateTo === dateTo
  )
}

export function isMonthlyLoggedInFilters(
  filters: ReportFilters,
  stages: ReportFilterOptions['stages'],
  now = new Date()
) {
  return matchesMonthlyStageReport(filters, findLoggedInStageId(stages), now)
}

export function isMonthlyDisbursedFilters(
  filters: ReportFilters,
  stages: ReportFilterOptions['stages'],
  now = new Date()
) {
  return matchesMonthlyStageReport(filters, findDisbursedStageId(stages), now)
}
