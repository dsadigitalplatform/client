import type { ReportDetailGroupDimension, ReportDetailRow, ReportQueryResponse } from '../reports.types'
import { buildDetailGroups } from './buildDetailGroups'
import { formatDate, formatINR, groupByLabel } from './exportReport'

function detailCells(row: ReportDetailRow, isHistorical: boolean, indent = '') {
  if (isHistorical) {
    return [
      `${indent}${row.customerName ?? ''}`,
      '',
      row.loanTypeName ?? '',
      row.bankName ?? '',
      row.auditStageName ?? row.stageName ?? '',
      row.auditStagedDate ?? '',
      row.agentName ?? '',
      formatINR(row.requestedAmount),
      formatDate(row.createdAt),
      ''
    ]
  }

  return [
    `${indent}${row.customerName ?? ''}`,
    '',
    row.loanTypeName ?? '',
    row.bankName ?? '',
    row.stageName ?? '',
    row.agentName ?? '',
    formatINR(row.requestedAmount),
    formatDate(row.createdAt),
    ''
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
  if (data.details.length === 0) return []

  const isHistorical = data.dataMode === 'historical'
  const { primary, hasSecondary, secondary, groupingLabel, groups } = resolveDetailGrouping(data, groupBySecondary)

  const header = isHistorical
    ? [
        'Level',
        `${groupByLabel(primary)} / Customer`,
        'Cases',
        'Loan type',
        'Bank',
        'Stage (audit)',
        'Staged date',
        'Agent',
        'Amount',
        'Created',
        'Note'
      ]
    : [
        'Level',
        `${groupByLabel(primary)} / Customer`,
        'Cases',
        'Loan type',
        'Bank',
        'Stage',
        'Agent',
        'Amount',
        'Created',
        'Note'
      ]

  const rows: string[][] = [[`Grouped detail (${groupingLabel})`], header]

  groups.forEach(group => {
    rows.push(
      isHistorical
        ? [
            'GROUP',
            group.label,
            String(group.count),
            '',
            '',
            '',
            '',
            '',
            formatINR(group.amount),
            '',
            'GROUP TOTAL'
          ]
        : ['GROUP', group.label, String(group.count), '', '', '', '', formatINR(group.amount), '', 'GROUP TOTAL']
    )

    if (hasSecondary && secondary) {
      group.subgroups.forEach(subgroup => {
        rows.push(
          isHistorical
            ? [
                'SUBGROUP',
                subgroup.label,
                String(subgroup.count),
                '',
                '',
                '',
                '',
                '',
                formatINR(subgroup.amount),
                '',
                'SUBTOTAL'
              ]
            : ['SUBGROUP', subgroup.label, String(subgroup.count), '', '', '', '', formatINR(subgroup.amount), '', 'SUBTOTAL']
        )

        subgroup.rows.forEach(row => {
          rows.push(['DETAIL', ...detailCells(row, isHistorical)])
        })
      })
    } else {
      group.rows.forEach(row => {
        rows.push(['DETAIL', ...detailCells(row, isHistorical)])
      })
    }

    rows.push([])
  })

  return rows
}

export function buildFlatDetailCsvRows(data: ReportQueryResponse): string[][] {
  if (data.details.length === 0) return []

  const isHistorical = data.dataMode === 'historical'
  const limitNote = data.details.length >= 500 ? ' (max 500 rows)' : ''

  const header = isHistorical
    ? ['Customer', 'Loan type', 'Bank', 'Stage (audit)', 'Staged date', 'Agent', 'Amount', 'Created']
    : ['Customer', 'Loan type', 'Bank', 'Stage', 'Agent', 'Amount', 'Created']

  const rows: string[][] = [[`Detailed rows (flat list${limitNote})`], header]

  data.details.forEach(row => {
    rows.push(
      isHistorical
        ? [
            row.customerName ?? '',
            row.loanTypeName ?? '',
            row.bankName ?? '',
            row.auditStageName ?? row.stageName ?? '',
            row.auditStagedDate ?? '',
            row.agentName ?? '',
            formatINR(row.requestedAmount),
            formatDate(row.createdAt)
          ]
        : [
            row.customerName ?? '',
            row.loanTypeName ?? '',
            row.bankName ?? '',
            row.stageName ?? '',
            row.agentName ?? '',
            formatINR(row.requestedAmount),
            formatDate(row.createdAt)
          ]
    )
  })

  return rows
}

export function buildFlatDetailHtml(data: ReportQueryResponse): string {
  if (data.details.length === 0) return ''

  const isHistorical = data.dataMode === 'historical'
  const limitNote = data.details.length >= 500 ? ', max 500 shown' : ''

  const escape = (value: string | null | undefined) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headerCells = isHistorical
    ? '<th>Customer</th><th>Loan type</th><th>Bank</th><th>Stage (audit)</th><th>Staged date</th><th>Agent</th><th>Amount</th><th>Created</th>'
    : '<th>Customer</th><th>Loan type</th><th>Bank</th><th>Stage</th><th>Agent</th><th>Amount</th><th>Created</th>'

  const body = data.details
    .map(row =>
      isHistorical
        ? `<tr><td>${escape(row.customerName)}</td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.auditStageName ?? row.stageName)}</td><td>${escape(row.auditStagedDate)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td><td>${escape(formatDate(row.createdAt))}</td></tr>`
        : `<tr><td>${escape(row.customerName)}</td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.stageName)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td><td>${escape(formatDate(row.createdAt))}</td></tr>`
    )
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

  const escape = (value: string | null | undefined) =>
    String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headerCells = isHistorical
    ? `<th>Level</th><th>${escape(groupByLabel(primary))} / Customer</th><th>Cases</th><th>Loan type</th><th>Bank</th><th>Stage (audit)</th><th>Staged date</th><th>Agent</th><th>Amount</th><th>Created</th>`
    : `<th>Level</th><th>${escape(groupByLabel(primary))} / Customer</th><th>Cases</th><th>Loan type</th><th>Bank</th><th>Stage</th><th>Agent</th><th>Amount</th><th>Created</th>`

  const body: string[] = []

  groups.forEach(group => {
    body.push(
      `<tr class="group-row-primary">
        <td><span class="level-badge level-group">GROUP</span></td>
        <td><strong>${escape(group.label)}</strong></td>
        <td class="num"><strong>${group.count}</strong></td>
        <td colspan="${isHistorical ? 5 : 4}"></td>
        <td class="num amount-total"><strong>${escape(formatINR(group.amount))}</strong><div class="sum-label">Group total</div></td>
        <td></td>
      </tr>`
    )

    if (hasSecondary && secondary) {
      group.subgroups.forEach(subgroup => {
        body.push(
          `<tr class="group-row-secondary">
            <td><span class="level-badge level-subgroup">SUB</span></td>
            <td class="indent-sub"><strong>${escape(subgroup.label)}</strong><div class="sum-label">${escape(groupByLabel(secondary))} subtotal</div></td>
            <td class="num"><strong>${subgroup.count}</strong></td>
            <td colspan="${isHistorical ? 5 : 4}"></td>
            <td class="num amount-total"><strong>${escape(formatINR(subgroup.amount))}</strong><div class="sum-label">Subtotal</div></td>
            <td></td>
          </tr>`
        )

        subgroup.rows.forEach(row => {
          body.push(
            isHistorical
              ? `<tr class="detail-row"><td></td><td class="indent-detail">${escape(row.customerName)}</td><td></td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.auditStageName ?? row.stageName)}</td><td>${escape(row.auditStagedDate)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td><td>${escape(formatDate(row.createdAt))}</td></tr>`
              : `<tr class="detail-row"><td></td><td class="indent-detail">${escape(row.customerName)}</td><td></td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.stageName)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td><td>${escape(formatDate(row.createdAt))}</td></tr>`
          )
        })
      })
    } else {
      group.rows.forEach(row => {
        body.push(
          isHistorical
            ? `<tr class="detail-row"><td></td><td class="indent-detail">${escape(row.customerName)}</td><td></td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.auditStageName ?? row.stageName)}</td><td>${escape(row.auditStagedDate)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td><td>${escape(formatDate(row.createdAt))}</td></tr>`
            : `<tr class="detail-row"><td></td><td class="indent-detail">${escape(row.customerName)}</td><td></td><td>${escape(row.loanTypeName)}</td><td>${escape(row.bankName)}</td><td>${escape(row.stageName)}</td><td>${escape(row.agentName)}</td><td class="num">${escape(formatINR(row.requestedAmount))}</td><td>${escape(formatDate(row.createdAt))}</td></tr>`
        )
      })
    }
  })

  const limitNote = data.details.length >= 500 ? ', max 500 shown' : ''

  return `<h2>Grouped detail (${escape(groupingLabel)})${limitNote}</h2><table class="grouped-detail-table"><thead><tr>${headerCells}</tr></thead><tbody>${body.join('')}</tbody></table>`
}
