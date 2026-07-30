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

export function enrichSummaryWithDisbursement(summary: ReportSummary, details: ReportDetailRow[]): ReportSummary {
  const byLead = new Map<string, ReportDetailRow>()

  for (const row of details) {
    if (row.disbursementStatus == null) continue
    if (!byLead.has(row.leadId)) byLead.set(row.leadId, row)
  }

  if (byLead.size === 0) return summary

  let totalDisbursedAmount = 0
  let totalRemainingAmount = 0
  let disbursementPending = 0
  let disbursementPartial = 0
  let disbursementCompleted = 0

  byLead.forEach(row => {
    totalDisbursedAmount += Number(row.totalDisbursedAmount || 0)
    totalRemainingAmount += Number(row.remainingAmount || 0)

    if (row.disbursementStatus === 'COMPLETED') disbursementCompleted += 1
    else if (row.disbursementStatus === 'PARTIAL') disbursementPartial += 1
    else disbursementPending += 1
  })

  return {
    ...summary,
    disbursementTrackedCases: byLead.size,
    totalDisbursedAmount,
    totalRemainingAmount,
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

export function exportDisbursementCells(
  row: ReportDetailRow,
  mode: 'display' | 'spreadsheet' = 'display'
): (string | number)[] {
  if (row.disbursementStatus == null) {
    return ['', '', '']
  }

  if (mode === 'spreadsheet') {
    return [
      disbursementStatusLabel(row.disbursementStatus),
      toSpreadsheetAmount(row.remainingAmount),
      toSpreadsheetAmount(row.totalDisbursedAmount)
    ]
  }

  return [
    disbursementStatusLabel(row.disbursementStatus),
    formatExportINR(row.remainingAmount),
    formatExportINR(row.totalDisbursedAmount)
  ]
}

export function buildDisbursementSummaryExportRows(
  summary: ReportSummary,
  mode: 'display' | 'spreadsheet' = 'display'
): (string | number)[][] {
  const amountCell = (value: number | null | undefined) =>
    mode === 'spreadsheet' ? toSpreadsheetAmount(value) : formatExportINR(value)

  return [
    ['Total disbursed', amountCell(summary.totalDisbursedAmount)],
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
