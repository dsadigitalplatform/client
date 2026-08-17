import type { ReportFilterOptions, ReportFilters } from '../reports.types'
import { DEFAULT_REPORT_FILTERS } from '../reports.types'

export type MonthRef = { year: number; month: number }

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function getCurrentMonthRef(now = new Date()): MonthRef {
  return { year: now.getFullYear(), month: now.getMonth() }
}

export function getMonthDateRange(ref: MonthRef, now = new Date()) {
  const { year, month } = ref
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  const dateFrom = `${year}-${pad2(month + 1)}-01`
  const dateTo = formatDateInput(isCurrentMonth ? now : new Date(year, month + 1, 0))

  return { dateFrom, dateTo }
}

export function getCurrentMonthDateRange(now = new Date()) {
  return getMonthDateRange(getCurrentMonthRef(now), now)
}

export function shiftMonthRef(ref: MonthRef, delta: number): MonthRef {
  const next = new Date(ref.year, ref.month + delta, 1)

  return { year: next.getFullYear(), month: next.getMonth() }
}

export function formatMonthLabel(ref: MonthRef) {
  return new Date(ref.year, ref.month, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric'
  })
}

export function formatMonthRangeCaption(ref: MonthRef, now = new Date()) {
  const { dateFrom, dateTo } = getMonthDateRange(ref, now)
  const from = new Date(`${dateFrom}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const to = new Date(`${dateTo}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  return `${from} – ${to}`
}

export function isCurrentMonthRef(ref: MonthRef, now = new Date()) {
  return ref.year === now.getFullYear() && ref.month === now.getMonth()
}

export function isFutureMonthRef(ref: MonthRef, now = new Date()) {
  return ref.year > now.getFullYear() || (ref.year === now.getFullYear() && ref.month > now.getMonth())
}

export function parseMonthRefFromFilters(filters: ReportFilters, now = new Date()): MonthRef | null {
  if (!filters.dateFrom || !filters.dateTo) return null

  const match = /^(\d{4})-(\d{2})-01$/.exec(filters.dateFrom)

  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1

  if (month < 0 || month > 11) return null

  const expected = getMonthDateRange({ year, month }, now)

  if (filters.dateTo !== expected.dateTo) return null

  return { year, month }
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

export function findRejectedStageIds(stages: ReportFilterOptions['stages']) {
  const flagged = stages.filter(s => s.isRejected).map(s => s.id)

  if (flagged.length > 0) return flagged

  return stages.filter(s => /reject/i.test(s.name)).map(s => s.id)
}

export function findRejectedStageId(stages: ReportFilterOptions['stages']) {
  return findRejectedStageIds(stages)[0] ?? null
}

function sameSortedIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false

  const sortedA = [...a].sort()
  const sortedB = [...b].sort()

  return sortedA.every((id, index) => id === sortedB[index])
}

export function buildMonthlyStageReportFilters(
  stageIds: string | string[],
  overrides: Partial<ReportFilters> = {},
  monthRef?: MonthRef,
  now = new Date()
): ReportFilters {
  const { dateFrom, dateTo } = monthRef ? getMonthDateRange(monthRef, now) : getCurrentMonthDateRange(now)
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
  overrides: Partial<ReportFilters> = {},
  monthRef?: MonthRef,
  now = new Date()
): ReportFilters {
  const disbursedStageId = findDisbursedStageId(stages)
  const { dateFrom, dateTo } = monthRef ? getMonthDateRange(monthRef, now) : getCurrentMonthDateRange(now)

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
    ...buildMonthlyStageReportFilters(disbursedStageId, {}, monthRef, now),
    includeDisbursementActivityInRange: true,
    ...overrides
  }
}

export function buildDefaultMonthlyLoggedInFilters(
  stages: ReportFilterOptions['stages'],
  monthRef?: MonthRef,
  now = new Date()
) {
  const stageIds = findLoggedInStageIds(stages)

  return stageIds.length > 0 ? buildMonthlyStageReportFilters(stageIds, {}, monthRef, now) : null
}

function resolveActiveStageIds(filters: ReportFilters) {
  if (filters.stageIds && filters.stageIds.length > 0) return filters.stageIds
  if (filters.stageId) return [filters.stageId]

  return []
}

function matchesMonthlyStageReport(
  filters: ReportFilters,
  stageIds: string[],
  monthRef: MonthRef,
  now = new Date()
) {
  if (stageIds.length === 0) return false

  const { dateFrom, dateTo } = getMonthDateRange(monthRef, now)
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
  const monthRef = parseMonthRefFromFilters(filters, now)

  if (!monthRef) return false

  return matchesMonthlyStageReport(filters, findLoggedInStageIds(stages), monthRef, now)
}

export function isMonthlyDisbursedFilters(
  filters: ReportFilters,
  stages: ReportFilterOptions['stages'],
  now = new Date()
) {
  if (!filters.includeDisbursementActivityInRange) return false

  const monthRef = parseMonthRefFromFilters(filters, now)

  if (!monthRef) return false

  const disbursedStageId = findDisbursedStageId(stages)
  const { dateFrom, dateTo } = getMonthDateRange(monthRef, now)

  if (filters.dataMode !== 'historical') return false
  if (filters.dateFrom !== dateFrom || filters.dateTo !== dateTo) return false

  if (!disbursedStageId) {
    return !filters.stageId && !(filters.stageIds && filters.stageIds.length > 0)
  }

  return matchesMonthlyStageReport(filters, [disbursedStageId], monthRef, now)
}

export function detectMonthlyReportType(
  filters: ReportFilters,
  stages: ReportFilterOptions['stages'],
  now = new Date()
): 'logged-in' | 'disbursed' | null {
  if (isMonthlyLoggedInFilters(filters, stages, now)) return 'logged-in'
  if (isMonthlyDisbursedFilters(filters, stages, now)) return 'disbursed'

  return null
}
