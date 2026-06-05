export type TimelineMode = 'WEEK' | 'MONTH' | 'YEAR'

export type TimelinePoint = {
  label: string
  value: number
  sortKey: number
}

export type TimelineRange = '8W' | '12W' | '6M' | '12M' | 'ALL'

/** Global dashboard date window — months (1–24) or all time */
export type DashboardTimePeriod = { mode: 'all' } | { mode: 'months'; months: number }

export const DASHBOARD_PERIOD_MONTH_MIN = 1
export const DASHBOARD_PERIOD_MONTH_MAX = 24
export const DASHBOARD_PERIOD_DEFAULT_MONTHS = 12

export type DashboardPeriodPreset = '8W' | '6M' | '12M' | 'ALL'

const PRESET_MONTHS: Record<Exclude<DashboardPeriodPreset, 'ALL'>, number> = {
  '8W': 2,
  '6M': 6,
  '12M': 12
}

export function presetToPeriod(preset: DashboardPeriodPreset): DashboardTimePeriod {
  if (preset === 'ALL') return { mode: 'all' }

  return { mode: 'months', months: PRESET_MONTHS[preset] }
}

export function periodToPreset(period: DashboardTimePeriod): DashboardPeriodPreset | null {
  if (period.mode === 'all') return 'ALL'
  if (period.months === 2) return '8W'
  if (period.months === 6) return '6M'
  if (period.months === 12) return '12M'

  return null
}

export function clampDashboardMonths(months: number) {
  return Math.min(DASHBOARD_PERIOD_MONTH_MAX, Math.max(DASHBOARD_PERIOD_MONTH_MIN, Math.round(months)))
}

export function filterByDashboardPeriod<T>(
  items: T[],
  getDate: (item: T) => Date | null | undefined,
  period: DashboardTimePeriod
): T[] {
  if (period.mode === 'all') return items

  const dated = items
    .map(item => ({ item, date: getDate(item) }))
    .filter((x): x is { item: T; date: Date } => x.date != null && Number.isFinite(x.date.getTime()))

  if (dated.length === 0) return items

  const maxTs = Math.max(...dated.map(x => x.date.getTime()))
  const cutoff = new Date(maxTs)

  cutoff.setMonth(cutoff.getMonth() - period.months)
  cutoff.setHours(0, 0, 0, 0)

  return items.filter(item => {
    const date = getDate(item)

    if (!date || !Number.isFinite(date.getTime())) return true

    return date.getTime() >= cutoff.getTime()
  })
}

export function getDashboardPeriodWindow(period: DashboardTimePeriod, now = new Date()) {
  const to = now

  if (period.mode === 'all') {
    return { from: null as Date | null, to }
  }

  const from = new Date(now)

  from.setMonth(from.getMonth() - period.months)
  from.setHours(0, 0, 0, 0)

  return { from, to }
}

export function formatDashboardPeriodLabel(period: DashboardTimePeriod) {
  if (period.mode === 'all') return 'All time'
  if (period.months === 12) return 'Last 1 year'
  if (period.months === 1) return 'Last month'

  return `Last ${period.months} months`
}

export function formatDashboardPeriodRange(period: DashboardTimePeriod, now = new Date()) {
  const { from, to } = getDashboardPeriodWindow(period, now)
  const fmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' })

  if (!from) return 'All recorded activity'

  return `${fmt.format(from)} – ${fmt.format(to)}`
}

export type DatedAmount = { date: Date; amount: number }

const RANGE_MS: Record<Exclude<TimelineRange, 'ALL'>, number> = {
  '8W': 8 * 7 * 24 * 60 * 60 * 1000,
  '12W': 12 * 7 * 24 * 60 * 60 * 1000,
  '6M': 183 * 24 * 60 * 60 * 1000,
  '12M': 365 * 24 * 60 * 60 * 1000
}

export function filterByTimelineRange(rows: DatedAmount[], range: TimelineRange): DatedAmount[] {
  if (range === 'ALL' || rows.length === 0) return rows

  const maxTs = Math.max(...rows.map(r => r.date.getTime()))
  const cutoff = maxTs - RANGE_MS[range]

  return rows.filter(r => r.date.getTime() >= cutoff)
}

/** Prefer weekly; suggest monthly when enough history exists. */
export function suggestTimelineMode(rows: DatedAmount[]): TimelineMode {
  if (rows.length === 0) return 'WEEK'

  const minTs = Math.min(...rows.map(r => r.date.getTime()))
  const maxTs = Math.max(...rows.map(r => r.date.getTime()))
  const spanDays = Math.max(1, Math.ceil((maxTs - minTs) / (1000 * 60 * 60 * 24)))

  const monthKeys = new Set<string>()

  rows.forEach(r => {
    monthKeys.add(`${r.date.getFullYear()}-${r.date.getMonth()}`)
  })

  if (spanDays > 420 || monthKeys.size > 14) return 'YEAR'
  if (spanDays > 45 || monthKeys.size >= 3) return 'MONTH'

  return 'WEEK'
}

export function timelineModeLabel(mode: TimelineMode) {
  if (mode === 'WEEK') return 'Weekly'
  if (mode === 'MONTH') return 'Monthly'

  return 'Yearly'
}

export function buildTimelineBuckets(
  rows: DatedAmount[],
  mode: TimelineMode
): TimelinePoint[] {
  if (rows.length === 0) return []

  const buckets = new Map<string, TimelinePoint>()

  rows.forEach(r => {
    const d = new Date(r.date)
    let key = ''
    let label = ''
    let sortKey = 0

    if (mode === 'WEEK') {
      const day = d.getDay()
      const diff = day === 0 ? -6 : 1 - day

      d.setDate(d.getDate() + diff)
      d.setHours(0, 0, 0, 0)
      key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      label = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d)
      sortKey = d.getTime()
    } else if (mode === 'MONTH') {
      d.setDate(1)
      d.setHours(0, 0, 0, 0)
      key = `${d.getFullYear()}-${d.getMonth() + 1}`
      label = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(d)
      sortKey = d.getTime()
    } else {
      d.setMonth(0, 1)
      d.setHours(0, 0, 0, 0)
      key = `${d.getFullYear()}`
      label = String(d.getFullYear())
      sortKey = d.getTime()
    }

    const prev = buckets.get(key)

    if (prev) prev.value += r.amount
    else buckets.set(key, { label, value: r.amount, sortKey })
  })

  const sorted = Array.from(buckets.values()).sort((a, b) => a.sortKey - b.sortKey)
  const maxPoints = mode === 'WEEK' ? 12 : mode === 'MONTH' ? 14 : 8

  return sorted.slice(-maxPoints)
}

export function isTimelineModeRecommended(rows: DatedAmount[], mode: TimelineMode) {
  return suggestTimelineMode(rows) === mode
}
