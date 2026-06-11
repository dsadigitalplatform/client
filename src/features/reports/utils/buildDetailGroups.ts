import type { ReportBreakdownRow, ReportDetailRow, ReportGroupBy } from '../reports.types'

export type DetailGroupDimension = Exclude<ReportGroupBy, 'time'>

export type DetailSubgroup = {
  key: string
  label: string
  count: number
  amount: number
  order?: number | null
  rows: ReportDetailRow[]
}

export type DetailPrimaryGroup = {
  key: string
  label: string
  count: number
  amount: number
  order?: number | null
  subgroups: DetailSubgroup[]
  rows: ReportDetailRow[]
}

function rowAmount(row: ReportDetailRow) {
  const amount = Number(row.requestedAmount ?? 0)

  return Number.isFinite(amount) ? amount : 0
}

function getDimensionValue(
  row: ReportDetailRow,
  dimension: DetailGroupDimension,
  isHistorical: boolean
): { key: string; label: string } {
  switch (dimension) {
    case 'stage': {
      const label = (isHistorical ? row.auditStageName ?? row.stageName : row.stageName) ?? 'No stage'

      return { key: label, label }
    }
    case 'agent': {
      const label = row.agentName ?? 'Unassigned'

      return { key: label, label }
    }
    case 'customer': {
      const label = row.customerName ?? 'Unknown customer'

      return { key: label, label }
    }
    case 'bank': {
      const label = row.bankName ?? 'No bank'

      return { key: label, label }
    }
    case 'loanType': {
      const label = row.loanTypeName ?? 'No loan type'

      return { key: label, label }
    }
    default:
      return { key: 'unknown', label: 'Unknown' }
  }
}

function buildOrderMap(breakdown: ReportBreakdownRow[], dimension: DetailGroupDimension) {
  if (dimension !== 'stage') return new Map<string, number | null>()

  return new Map(breakdown.map(row => [row.label, row.order ?? null]))
}

function sortGroups<T extends { label: string; order?: number | null; amount: number }>(
  groups: T[],
  dimension: DetailGroupDimension
) {
  return [...groups].sort((a, b) => {
    if (dimension === 'stage') {
      const orderA = a.order ?? Number.MAX_SAFE_INTEGER
      const orderB = b.order ?? Number.MAX_SAFE_INTEGER

      if (orderA !== orderB) return orderA - orderB
    }

    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  })
}

function finalizeSubgroup(
  key: string,
  label: string,
  rows: ReportDetailRow[],
  order?: number | null
): DetailSubgroup {
  return {
    key,
    label,
    count: rows.length,
    amount: rows.reduce((sum, row) => sum + rowAmount(row), 0),
    order,
    rows
  }
}

function finalizePrimaryGroup(
  key: string,
  label: string,
  subgroups: DetailSubgroup[],
  rows: ReportDetailRow[],
  order?: number | null
): DetailPrimaryGroup {
  const allRows = subgroups.length > 0 ? subgroups.flatMap(group => group.rows) : rows

  return {
    key,
    label,
    count: allRows.length,
    amount: allRows.reduce((sum, row) => sum + rowAmount(row), 0),
    order,
    subgroups,
    rows
  }
}

export function buildDetailGroups(params: {
  rows: ReportDetailRow[]
  primary: DetailGroupDimension
  secondary: DetailGroupDimension | null
  isHistorical: boolean
  breakdown?: ReportBreakdownRow[]
}): DetailPrimaryGroup[] {
  const { rows, primary, secondary, isHistorical, breakdown = [] } = params
  const primaryOrderMap = buildOrderMap(breakdown, primary)
  const secondaryOrderMap = buildOrderMap(breakdown, secondary ?? 'stage')
  const effectiveSecondary = secondary && secondary !== primary ? secondary : null

  const primaryMap = new Map<string, { label: string; rows: ReportDetailRow[] }>()

  rows.forEach(row => {
    const { key, label } = getDimensionValue(row, primary, isHistorical)
    const existing = primaryMap.get(key)

    if (existing) {
      existing.rows.push(row)
    } else {
      primaryMap.set(key, { label, rows: [row] })
    }
  })

  const groups = Array.from(primaryMap.entries()).map(([key, value]) => {
    if (!effectiveSecondary) {
      return finalizePrimaryGroup(key, value.label, [], value.rows, primaryOrderMap.get(value.label))
    }

    const secondaryMap = new Map<string, { label: string; rows: ReportDetailRow[] }>()

    value.rows.forEach(row => {
      const { key: subKey, label: subLabel } = getDimensionValue(row, effectiveSecondary, isHistorical)
      const existing = secondaryMap.get(subKey)

      if (existing) {
        existing.rows.push(row)
      } else {
        secondaryMap.set(subKey, { label: subLabel, rows: [row] })
      }
    })

    const subgroups = Array.from(secondaryMap.entries()).map(([subKey, subValue]) =>
      finalizeSubgroup(subKey, subValue.label, subValue.rows, secondaryOrderMap.get(subValue.label))
    )

    return finalizePrimaryGroup(
      key,
      value.label,
      sortGroups(subgroups, effectiveSecondary),
      [],
      primaryOrderMap.get(value.label)
    )
  })

  return sortGroups(groups, primary)
}
