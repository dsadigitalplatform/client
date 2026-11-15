import { computeProgressPercent } from '@features/loan-disbursements/utils/disbursementCalculations'
import type { ReportDetailRow, ReportDisbursementStatus, ReportSummary } from '../reports.types'

export function mapReportDisbursementFields(tracker: {
  approvedAmount?: unknown
  totalDisbursedAmount?: unknown
  remainingAmount?: unknown
  disbursementStatus?: unknown
} | null | undefined): Pick<
  ReportDetailRow,
  'disbursementStatus' | 'totalDisbursedAmount' | 'remainingAmount' | 'progressPercent' | 'trackerApprovedAmount'
> {
  if (!tracker) {
    return {
      disbursementStatus: null,
      totalDisbursedAmount: null,
      remainingAmount: null,
      progressPercent: null,
      trackerApprovedAmount: null
    }
  }

  const approvedAmount = tracker.approvedAmount != null ? Number(tracker.approvedAmount) : 0
  const totalDisbursedAmount = tracker.totalDisbursedAmount != null ? Number(tracker.totalDisbursedAmount) : 0
  const remainingAmount = tracker.remainingAmount != null ? Number(tracker.remainingAmount) : 0
  const rawStatus = String(tracker.disbursementStatus || 'PENDING').toUpperCase()
  const disbursementStatus: ReportDisbursementStatus =
    rawStatus === 'COMPLETED' || rawStatus === 'PARTIAL' ? rawStatus : 'PENDING'

  return {
    disbursementStatus,
    totalDisbursedAmount,
    remainingAmount,
    progressPercent: computeProgressPercent(approvedAmount, totalDisbursedAmount),
    trackerApprovedAmount: approvedAmount
  }
}

export function hasReportDisbursementData(rows: ReportDetailRow[]) {
  return rows.some(row => row.disbursementStatus != null)
}

export function periodDisbursementAmount(row: ReportDetailRow) {
  if (row.periodDisbursedAmount == null) return null

  const amount = Number(row.periodDisbursedAmount)

  return Number.isFinite(amount) && amount > 0 ? amount : null
}

export function hasPeriodDisbursement(row: ReportDetailRow) {
  return periodDisbursementAmount(row) != null
}

export function hasPeriodDisbursementData(rows: ReportDetailRow[]) {
  return rows.some(hasPeriodDisbursement)
}

export function applyPeriodDisbursedAmounts(details: ReportDetailRow[], periodByLead: Map<string, number>) {
  if (periodByLead.size === 0) return details

  return details.map(row => {
    const period = periodByLead.get(row.leadId)

    if (period == null || !Number.isFinite(period) || period <= 0) return row
    if (row.periodDisbursedAmount === period) return row

    return { ...row, periodDisbursedAmount: period }
  })
}

export function enrichSummaryWithDisbursement(summary: ReportSummary, details: ReportDetailRow[]): ReportSummary {
  const byLead = new Map<string, ReportDetailRow>()

  for (const row of details) {
    if (row.disbursementStatus == null) continue
    if (!byLead.has(row.leadId)) byLead.set(row.leadId, row)
  }

  if (byLead.size === 0) return summary

  let totalDisbursedAmount = 0
  let totalRemainingAmount = 0
  let periodDisbursedAmount = 0
  let hasPeriod = false
  let disbursementPending = 0
  let disbursementPartial = 0
  let disbursementCompleted = 0

  byLead.forEach(row => {
    totalDisbursedAmount += Number(row.totalDisbursedAmount || 0)
    totalRemainingAmount += Number(row.remainingAmount || 0)

    const periodAmount = periodDisbursementAmount(row)

    if (periodAmount != null) {
      hasPeriod = true
      periodDisbursedAmount += periodAmount
    }

    if (row.disbursementStatus === 'COMPLETED') disbursementCompleted += 1
    else if (row.disbursementStatus === 'PARTIAL') disbursementPartial += 1
    else disbursementPending += 1
  })

  return {
    ...summary,
    disbursementTrackedCases: byLead.size,
    totalDisbursedAmount,
    totalRemainingAmount,
    ...(hasPeriod ? { periodDisbursedAmount } : {}),
    disbursementPending,
    disbursementPartial,
    disbursementCompleted
  }
}

export function disbursementStatusLabel(status: ReportDisbursementStatus | null | undefined) {
  switch (status) {
    case 'COMPLETED':
      return 'Completed'
    case 'PARTIAL':
      return 'Partial'
    case 'PENDING':
      return 'Pending'
    default:
      return ''
  }
}

export function toSpreadsheetAmount(amount: number | null | undefined): number | '' {
  if (amount == null || !Number.isFinite(amount)) return ''

  return amount
}

function formatExportINR(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return ''

  return `₹ ${new Intl.NumberFormat('en-IN').format(amount)}`
}

export function exportDisbursementHeaders(includePeriod: boolean, periodTitle = 'This period') {
  return includePeriod
    ? ['Status', periodTitle, 'Remaining']
    : ['Status', 'Balance remaining', 'Disbursed']
}

export function exportDisbursementColumnCount(_includePeriod?: boolean) {
  return 3
}

export function exportDisbursementCells(
  row: ReportDetailRow,
  mode: 'display' | 'spreadsheet' = 'display',
  includePeriod = false
): (string | number)[] {
  const empty = ['', '', '']

  if (row.disbursementStatus == null) return empty

  const amountCell = (value: number | null | undefined) =>
    mode === 'spreadsheet' ? toSpreadsheetAmount(value) : formatExportINR(value)

  if (includePeriod) {
    return [
      disbursementStatusLabel(row.disbursementStatus),
      amountCell(periodDisbursementAmount(row)),
      amountCell(row.remainingAmount)
    ]
  }

  return [
    disbursementStatusLabel(row.disbursementStatus),
    amountCell(row.remainingAmount),
    amountCell(row.totalDisbursedAmount)
  ]
}

export function buildDisbursementSummaryExportRows(
  summary: ReportSummary,
  mode: 'display' | 'spreadsheet' = 'display',
  periodTitle = 'This period'
): (string | number)[][] {
  const amountCell = (value: number | null | undefined) =>
    mode === 'spreadsheet' ? toSpreadsheetAmount(value) : formatExportINR(value)

  const disbursedRow =
    summary.periodDisbursedAmount != null
      ? ([periodTitle, amountCell(summary.periodDisbursedAmount)] as (string | number)[])
      : (['Total disbursed', amountCell(summary.totalDisbursedAmount)] as (string | number)[])

  return [
    disbursedRow,
    ['Balance remaining', amountCell(summary.totalRemainingAmount)],
    ['Disbursement trackers', summary.disbursementTrackedCases != null ? String(summary.disbursementTrackedCases) : ''],
    ['Pending trackers', summary.disbursementPending != null ? String(summary.disbursementPending) : ''],
    ['Partial trackers', summary.disbursementPartial != null ? String(summary.disbursementPartial) : ''],
    ['Completed trackers', summary.disbursementCompleted != null ? String(summary.disbursementCompleted) : '']
  ]
}

export function disbursementStatusChipColor(status: ReportDisbursementStatus | null | undefined) {
  switch (status) {
    case 'COMPLETED':
      return 'success' as const
    case 'PARTIAL':
      return 'warning' as const
    case 'PENDING':
      return 'default' as const
    default:
      return 'default' as const
  }
}
