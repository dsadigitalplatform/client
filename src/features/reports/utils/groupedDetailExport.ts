import {
  showsLoanTypeDetailColumn,
  type ReportDetailGroupDimension,
  type ReportDetailRow,
  type ReportQueryResponse
} from '../reports.types'
import { buildDetailGroups } from './buildDetailGroups'
import { formatDate, formatINR, groupByLabel } from './exportReport'
import { reportPeriodTitle } from './monthlyReportHelpers'
import {
  exportDisbursementCells,
  exportDisbursementColumnCount,
  exportDisbursementHeaders,
  hasPeriodDisbursementData,
  toSpreadsheetAmount
} from './reportDisbursement'
import type { SpreadsheetCell } from './reportSpreadsheetExport'

type AmountExportMode = 'display' | 'spreadsheet'

function formatExportAmount(amount: number | null | undefined, mode: AmountExportMode): string | number {
  return mode === 'spreadsheet' ? toSpreadsheetAmount(amount) : formatINR(amount)
}

function detailCells(
  row: ReportDetailRow,
  isHistorical: boolean,
  mode: AmountExportMode,
  includeLoanType: boolean,
  includePeriod: boolean,
  indent = ''
) {
  const disbursementCells = exportDisbursementCells(row, mode, includePeriod)
  const loanTypeCell = includeLoanType ? [row.loanTypeName ?? ''] : []

  if (isHistorical) {
    return [
      `${indent}${row.customerName ?? ''}`,
      '',
      row.leadCode ?? '',
      ...loanTypeCell,
      row.bankName ?? '',
      row.auditStageName ?? row.stageName ?? '',
      row.auditStagedDate ?? '',
      row.agentName ?? '',
      formatExportAmount(row.requestedAmount, mode),
      ...disbursementCells,
      formatDate(row.createdAt),
      ''
    ]
  }

  return [
    `${indent}${row.customerName ?? ''}`,
    '',
    row.leadCode ?? '',
    ...loanTypeCell,
    row.bankName ?? '',
    row.stageName ?? '',
    row.agentName ?? '',
    formatExportAmount(row.requestedAmount, mode),
    ...disbursementCells,
    formatDate(row.createdAt),
    ''
  ]
}

function detailHeader(
  isHistorical: boolean,
  primaryLabel: string,
  includeLoanType: boolean,
  disbursementHeaders: string[]
) {
  const loanTypeHeader = includeLoanType ? ['Loan type'] : []

  if (isHistorical) {
    return [
      'Level',
      `${primaryLabel} / Customer`,
      'Cases',
      'Lead code',
      ...loanTypeHeader,
      'Bank',
      'Stage (audit)',
      'Staged date',
      'Agent',
      'Amount',
      ...disbursementHeaders,
      'Created',
      'Note'
    ]
  }

  return [
    'Level',
    `${primaryLabel} / Customer`,
    'Cases',
    'Lead code',
    ...loanTypeHeader,
    'Bank',
    'Stage',
    'Agent',
    'Amount',
    ...disbursementHeaders,
    'Created',
    'Note'
  ]
}

export function resolveDetailGrouping(data: ReportQueryResponse, groupBySecondary: ReportDetailGroupDimension | null) {
  const primary = data.groupBy === 'time' ? 'stage' : data.groupBy
  const hasSecondary = Boolean(groupBySecondary && groupBySecondary !== data.groupBy)

  return {
    primary,
    hasSecondary,
    secondary: hasSecondary ? groupBySecondary : null,
    groupingLabel: hasSecondary
      ? `${groupByLabel(primary)} → ${groupByLabel(groupBySecondary!)}`
      : groupByLabel(primary),
    groups: buildDetailGroups({
      rows: data.details,
      primary,
      secondary: hasSecondary ? groupBySecondary : null,
      isHistorical: data.dataMode === 'historical',
      breakdown: data.breakdown
    })
  }
}

export function buildGroupedDetailCsvRows(
  data: ReportQueryResponse,
  groupBySecondary: ReportDetailGroupDimension | null
): string[][] {
  return buildGroupedDetailSpreadsheetRows(data, groupBySecondary) as string[][]
}

export function buildGroupedDetailSpreadsheetRows(
  data: ReportQueryResponse,
  groupBySecondary: ReportDetailGroupDimension | null
): SpreadsheetCell[][] {
  if (data.details.length === 0) return []

  const isHistorical = data.dataMode === 'historical'
  const { primary, hasSecondary, secondary, groupingLabel, groups } = resolveDetailGrouping(data, groupBySecondary)
  const includeLoanType = showsLoanTypeDetailColumn(data.groupBy, groupBySecondary)
  const includePeriod = hasPeriodDisbursementData(data.details)
  const disbursementHeaders = exportDisbursementHeaders(includePeriod, reportPeriodTitle(data.filtersApplied))
  const header = detailHeader(isHistorical, groupByLabel(primary), includeLoanType, disbursementHeaders)
  const rows: SpreadsheetCell[][] = [[`Grouped detail (${groupingLabel})`], header]
  const emptyLeadCols = (isHistorical ? 6 : 5) - (includeLoanType ? 0 : 1)
  const emptyDisbursementCells: SpreadsheetCell[] = Array(exportDisbursementColumnCount(includePeriod)).fill('')

  groups.forEach(group => {
    rows.push([
      'GROUP',
      group.label,
      String(group.count),
      ...Array(emptyLeadCols).fill(''),
      toSpreadsheetAmount(group.amount),
      ...emptyDisbursementCells,
      '',
      'GROUP TOTAL'
    ])

    if (hasSecondary && secondary) {
      group.subgroups.forEach(subgroup => {
        rows.push([
          'SUBGROUP',
          subgroup.label,
          String(subgroup.count),
          ...Array(emptyLeadCols).fill(''),
          toSpreadsheetAmount(subgroup.amount),
          ...emptyDisbursementCells,
          '',
          'SUBTOTAL'
        ])

        subgroup.rows.forEach(row => {
          rows.push(['DETAIL', ...detailCells(row, isHistorical, 'spreadsheet', includeLoanType, includePeriod)])
        })
      })
    } else {
      group.rows.forEach(row => {
        rows.push(['DETAIL', ...detailCells(row, isHistorical, 'spreadsheet', includeLoanType, includePeriod)])
      })
    }

    rows.push([])
  })

  return rows
}

export function buildFlatDetailCsvRows(data: ReportQueryResponse): string[][] {
  return buildFlatDetailSpreadsheetRows(data) as string[][]
}

export function buildFlatDetailSpreadsheetRows(data: ReportQueryResponse): SpreadsheetCell[][] {
  if (data.details.length === 0) return []

  const isHistorical = data.dataMode === 'historical'
  const limitNote = data.details.length >= 500 ? ' (max 500 rows)' : ''
  const includePeriod = hasPeriodDisbursementData(data.details)
  const disbursementHeaders = exportDisbursementHeaders(includePeriod, reportPeriodTitle(data.filtersApplied))

  const header = isHistorical
    ? ['Customer', 'Lead code', 'Loan type', 'Bank', 'Stage (audit)', 'Staged date', 'Agent', 'Amount', ...disbursementHeaders, 'Created']
    : ['Customer', 'Lead code', 'Loan type', 'Bank', 'Stage', 'Agent', 'Amount', ...disbursementHeaders, 'Created']

  const rows: SpreadsheetCell[][] = [[`Detailed rows (flat list${limitNote})`], header]

  data.details.forEach(row => {
    rows.push(
      isHistorical
        ? [
            row.customerName ?? '',
            row.leadCode ?? '',
            row.loanTypeName ?? '',
            row.bankName ?? '',
            row.auditStageName ?? row.stageName ?? '',
            row.auditStagedDate ?? '',
            row.agentName ?? '',
            toSpreadsheetAmount(row.requestedAmount),
            ...exportDisbursementCells(row, 'spreadsheet', includePeriod),
            formatDate(row.createdAt)
          ]
        : [
            row.customerName ?? '',
            row.leadCode ?? '',
            row.loanTypeName ?? '',
            row.bankName ?? '',
            row.stageName ?? '',
            row.agentName ?? '',
            toSpreadsheetAmount(row.requestedAmount),
            ...exportDisbursementCells(row, 'spreadsheet', includePeriod),
            formatDate(row.createdAt)
          ]
    )
  })

  return rows
}

function disbursementHeaderHtml(includePeriod: boolean, periodTitle: string) {
  return exportDisbursementHeaders(includePeriod, periodTitle)
    .map(label => `<th>${label}</th>`)
    .join('')
}

function disbursementDetailHtmlCells(row: ReportDetailRow, includePeriod: boolean) {
  const escape = (value: string | null | undefined) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  return exportDisbursementCells(row, 'display', includePeriod)
    .map((value, index) => {
      const tag = index === 0 ? '<td>' : '<td class="num">'

      return `${tag}${escape(String(value))}</td>`
    })
    .join('')
}

export function buildFlatDetailHtml(data: ReportQueryResponse): string {
  if (data.details.length === 0) return ''

  const isHistorical = data.dataMode === 'historical'
  const limitNote = data.details.length >= 500 ? ', max 500 shown' : ''
  const includePeriod = hasPeriodDisbursementData(data.details)
  const disbursementHeaders = disbursementHeaderHtml(includePeriod, reportPeriodTitle(data.filtersApplied))

  const escape = (value: string | null | undefined) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headerCells = isHistorical
    ? `<th>Customer</th><th>Lead code</th><th>Loan type</th><th>Bank</th><th>Stage (audit)</th><th>Staged date</th><th>Agent</th><th>Amount</th>${disbursementHeaders}<th>Created</th>`
    : `<th>Customer</th><th>Lead code</th><th>Loan type</th><th>Bank</th><th>Stage</th><th>Agent</th><th>Amount</th>${disbursementHeaders}<th>Created</th>`

  const body = data.details
    .map(row => {
      const disbursementCells = disbursementDetailHtmlCells(row, includePeriod)

      return isHistorical
        ? `<tr><td>${escape(row.customerName)}</td><td>${escape(row.leadCode)}</td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.auditStageName ?? row.stageName)}</td><td>${escape(row.auditStagedDate)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td>${disbursementCells}<td>${escape(formatDate(row.createdAt))}</td></tr>`
        : `<tr><td>${escape(row.customerName)}</td><td>${escape(row.leadCode)}</td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.stageName)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td>${disbursementCells}<td>${escape(formatDate(row.createdAt))}</td></tr>`
    })
    .join('')

  return `<h2>Detailed rows (flat list${limitNote})</h2><table><thead><tr>${headerCells}</tr></thead><tbody>${body}</tbody></table>`
}

export function buildGroupedDetailHtml(
  data: ReportQueryResponse,
  groupBySecondary: ReportDetailGroupDimension | null
): string {
  if (data.details.length === 0) return ''

  const isHistorical = data.dataMode === 'historical'
  const { primary, hasSecondary, secondary, groupingLabel, groups } = resolveDetailGrouping(data, groupBySecondary)
  const includeLoanType = showsLoanTypeDetailColumn(data.groupBy, groupBySecondary)
  const includePeriod = hasPeriodDisbursementData(data.details)
  const disbursementColSpan = exportDisbursementColumnCount(includePeriod)
  const disbursementHeaders = disbursementHeaderHtml(includePeriod, reportPeriodTitle(data.filtersApplied))

  const escape = (value: string | null | undefined) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const emptyLeadColSpan = (isHistorical ? 6 : 5) - (includeLoanType ? 0 : 1)
  const loanTypeHeader = includeLoanType ? '<th>Loan type</th>' : ''

  const headerCells = isHistorical
    ? `<th>Level</th><th>${escape(groupByLabel(primary))} / Customer</th><th>Cases</th><th>Lead code</th>${loanTypeHeader}<th>Bank</th><th>Stage (audit)</th><th>Staged date</th><th>Agent</th><th>Amount</th>${disbursementHeaders}<th>Created</th>`
    : `<th>Level</th><th>${escape(groupByLabel(primary))} / Customer</th><th>Cases</th><th>Lead code</th>${loanTypeHeader}<th>Bank</th><th>Stage</th><th>Agent</th><th>Amount</th>${disbursementHeaders}<th>Created</th>`

  const body: string[] = []

  const groupAmountRow = (level: 'primary' | 'secondary', label: string, count: number, amount: number, note: string) => {
    const levelBadge =
      level === 'primary'
        ? '<span class="level-badge level-group">GROUP</span>'
        : '<span class="level-badge level-subgroup">SUB</span>'
    const labelCell =
      level === 'primary'
        ? `<td><strong>${escape(label)}</strong></td>`
        : `<td class="indent-sub"><strong>${escape(label)}</strong><div class="sum-label">${escape(note)}</div></td>`

    return `<tr class="group-row-${level === 'primary' ? 'primary' : 'secondary'}">
        <td>${levelBadge}</td>
        ${labelCell}
        <td class="num"><strong>${count}</strong></td>
        <td colspan="${emptyLeadColSpan}"></td>
        <td class="num amount-total"><strong>${escape(formatINR(amount))}</strong><div class="sum-label">${level === 'primary' ? 'Group total' : 'Subtotal'}</div></td>
        <td colspan="${disbursementColSpan}"></td>
        <td></td>
      </tr>`
  }

  const detailRowHtml = (row: ReportDetailRow) => {
    const disbursementCells = disbursementDetailHtmlCells(row, includePeriod)
    const loanTypeCell = includeLoanType ? `<td>${escape(row.loanTypeName)}</td>` : ''

    return isHistorical
      ? `<tr class="detail-row"><td></td><td class="indent-detail">${escape(row.customerName)}</td><td></td><td>${escape(row.leadCode)}</td>${loanTypeCell}<td>${escape(row.bankName)}</td><td>${escape(row.auditStageName ?? row.stageName)}</td><td>${escape(row.auditStagedDate)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td>${disbursementCells}<td>${escape(formatDate(row.createdAt))}</td></tr>`
      : `<tr class="detail-row"><td></td><td class="indent-detail">${escape(row.customerName)}</td><td></td><td>${escape(row.leadCode)}</td>${loanTypeCell}<td>${escape(row.bankName)}</td><td>${escape(row.stageName)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td>${disbursementCells}<td>${escape(formatDate(row.createdAt))}</td></tr>`
  }

  groups.forEach(group => {
    body.push(groupAmountRow('primary', group.label, group.count, group.amount, 'Group total'))

    if (hasSecondary && secondary) {
      group.subgroups.forEach(subgroup => {
        body.push(
          groupAmountRow('secondary', subgroup.label, subgroup.count, subgroup.amount, `${groupByLabel(secondary)} subtotal`)
        )

        subgroup.rows.forEach(row => {
          body.push(detailRowHtml(row))
        })
      })
    } else {
      group.rows.forEach(row => {
        body.push(detailRowHtml(row))
      })
    }
  })

  const limitNote = data.details.length >= 500 ? ', max 500 shown' : ''

  return `<h2>Grouped detail (${escape(groupingLabel)})${limitNote}</h2><table class="grouped-detail-table"><thead><tr>${headerCells}</tr></thead><tbody>${body.join('')}</tbody></table>`
}
