import type { ReportExportMeta, ReportQueryResponse } from '../reports.types'
import type { ReportChartImages } from './captureReportCharts'
import {
  buildFlatDetailCsvRows,
  buildFlatDetailHtml,
  buildGroupedDetailCsvRows,
  buildGroupedDetailHtml
} from './groupedDetailExport'
import { chartImagesToHtml } from './reportChartSvg'

const formatINR = (amount: number | null | undefined) => {
  if (amount == null || !Number.isFinite(amount)) return ''

  return `₹ ${new Intl.NumberFormat('en-IN').format(amount)}`
}

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return ''

  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return iso

  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function escapeCsvCell(value: string) {
  return `"${String(value).replace(/"/g, '""')}"`
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function buildHeaderRows(meta: ReportExportMeta) {
  return [
    ['Organisation', meta.organisationName],
    ['Prepared by', meta.preparedBy],
    ['Report date', meta.preparedAt],
    ['Report', meta.reportTitle],
    ['Data mode', meta.dataMode === 'historical' ? 'Stage history (audit)' : 'Current snapshot'],
    ...(meta.disclaimer ? [['Note', meta.disclaimer]] : []),
    []
  ]
}

export function exportReportExcel(data: ReportQueryResponse, meta: ReportExportMeta) {
  const rows: string[][] = [
    ...buildHeaderRows(meta),
    ['Summary'],
    ['Total cases', String(data.summary.totalCases)],
    ['Total amount', formatINR(data.summary.totalAmount)],
    ['Unique customers', String(data.summary.uniqueCustomers)],
    []
  ]

  if (data.breakdown.length > 0) {
    rows.push(['Breakdown', 'Cases', 'Amount'])
    data.breakdown.forEach(row => {
      rows.push([row.label, String(row.count), formatINR(row.amount)])
    })
    rows.push([])
  }

  if (data.trend.length > 0) {
    rows.push(['Trend period', 'Cases', 'Amount'])
    data.trend.forEach(row => {
      rows.push([row.label, String(row.count), formatINR(row.amount)])
    })
    rows.push([])
  }

  if (data.details.length > 0) {
    const detailRows =
      meta.detailFormat === 'flat'
        ? buildFlatDetailCsvRows(data)
        : buildGroupedDetailCsvRows(data, meta.groupBySecondary ?? null)

    rows.push(...detailRows)
  }

  const csv = `\uFEFF${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const suffix = meta.detailFormat === 'flat' ? '-flat' : ''

  a.href = url
  a.download = `report${suffix}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportReportExcelFlat(data: ReportQueryResponse, meta: ReportExportMeta) {
  exportReportExcel(data, { ...meta, detailFormat: 'flat' })
}

export function exportReportExcelFlatOnly(data: ReportQueryResponse) {
  if (data.details.length === 0) return

  const rows = buildFlatDetailCsvRows(data)
  const csv = `\uFEFF${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = `report-details-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function buildReportPrintHtml(data: ReportQueryResponse, meta: ReportExportMeta, charts?: ReportChartImages, options?: { autoPrint?: boolean }) {
  const isHistorical = data.dataMode === 'historical'
  const chartsHtml = charts ? chartImagesToHtml(charts) : ''
  const autoPrint = options?.autoPrint !== false

  const breakdownHtml =
    data.breakdown.length > 0
      ? `<h2>Breakdown</h2><table><thead><tr><th>Dimension</th><th>Cases</th><th>Amount</th></tr></thead><tbody>${data.breakdown
          .map(
            r =>
              `<tr><td>${escapeHtml(r.label)}</td><td>${r.count}</td><td>${escapeHtml(formatINR(r.amount))}</td></tr>`
          )
          .join('')}</tbody></table>`
      : ''

  const trendHtml =
    data.trend.length > 0
      ? `<h2>Trend</h2><table><thead><tr><th>Period</th><th>Cases</th><th>Amount</th></tr></thead><tbody>${data.trend
          .map(
            r =>
              `<tr><td>${escapeHtml(r.label)}</td><td>${r.count}</td><td>${escapeHtml(formatINR(r.amount))}</td></tr>`
          )
          .join('')}</tbody></table>`
      : ''

  const detailsHtml =
    data.details.length > 0
      ? meta.detailFormat === 'flat'
        ? buildFlatDetailHtml(data)
        : buildGroupedDetailHtml(data, meta.groupBySecondary ?? null)
      : ''

  const disclaimer = meta.disclaimer ?? (isHistorical ? 'Historical audit-based report.' : 'Current snapshot report.')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(meta.reportTitle)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 24px; font-size: 12px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { margin-bottom: 16px; color: #444; }
    .meta p { margin: 2px 0; }
    .banner { background: ${isHistorical ? '#fff3e0' : '#e3f2fd'}; border: 1px solid ${isHistorical ? '#ffb74d' : '#64b5f6'}; padding: 10px 12px; border-radius: 6px; margin: 12px 0 18px; }
    .summary { display: flex; flex-wrap: wrap; gap: 24px; margin: 12px 0 20px; }
    .summary div { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; min-width: 120px; }
    .summary strong { display: block; font-size: 16px; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; word-break: break-word; }
    th { background: #f5f5f5; }
    h2 { font-size: 14px; margin: 18px 0 8px; }
    h3 { font-size: 13px; margin: 0 0 10px; color: #333; }
    .charts { margin: 24px 0; page-break-inside: avoid; }
    .chart-block { margin-bottom: 28px; page-break-inside: avoid; }
    .chart-img {
      display: block;
      width: 100%;
      max-width: 760px;
      height: auto;
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 12px;
      background: #fff;
      box-sizing: border-box;
    }
    .print-hint { margin-top: 24px; padding: 10px 12px; background: #f5f5f5; border-radius: 6px; font-size: 11px; color: #555; }
    .grouped-detail-table .group-row-primary td { background: #e3f2fd; border-top: 2px solid #1976d2; }
    .grouped-detail-table .group-row-secondary td { background: #f3e5f5; border-top: 1px solid #9c27b0; }
    .grouped-detail-table .detail-row td { background: #fff; }
    .grouped-detail-table .level-badge { display: inline-block; font-size: 10px; font-weight: 700; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 4px; }
    .grouped-detail-table .level-group { background: #1976d2; color: #fff; }
    .grouped-detail-table .level-subgroup { background: #9c27b0; color: #fff; }
    .grouped-detail-table .indent-sub { padding-left: 22px !important; }
    .grouped-detail-table .indent-detail { padding-left: 36px !important; color: #333; }
    .grouped-detail-table .num { text-align: right; white-space: nowrap; }
    .grouped-detail-table .amount-total strong { font-size: 13px; }
    .grouped-detail-table .sum-label { font-size: 10px; color: #666; margin-top: 2px; }
    @media print {
      body { margin: 12mm; }
      .print-hint { display: none; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(meta.organisationName)}</h1>
  <div class="meta">
    <p><strong>${escapeHtml(meta.reportTitle)}</strong></p>
    <p>Prepared by: ${escapeHtml(meta.preparedBy)}</p>
    <p>Date: ${escapeHtml(meta.preparedAt)}</p>
  </div>
  <div class="banner">${escapeHtml(disclaimer)}</div>
  <div class="summary">
    <div>Total cases<strong>${data.summary.totalCases}</strong></div>
    <div>Total amount<strong>${escapeHtml(formatINR(data.summary.totalAmount))}</strong></div>
    <div>Customers<strong>${data.summary.uniqueCustomers}</strong></div>
  </div>
  ${chartsHtml}
  ${breakdownHtml}${trendHtml}${detailsHtml}
  <p class="print-hint">Use your browser&apos;s print dialog and choose &quot;Save as PDF&quot; to download this report.</p>
  ${
    autoPrint
      ? `<script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>`
      : ''
  }
</body>
</html>`
}

function printHtmlViaIframe(blobUrl: string) {
  const iframe = document.createElement('iframe')

  iframe.setAttribute('title', 'Report print preview')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.src = blobUrl

  const cleanup = () => {
    window.setTimeout(() => {
      iframe.remove()
      URL.revokeObjectURL(blobUrl)
    }, 1500)
  }

  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      cleanup()
    }
  }

  document.body.appendChild(iframe)
}

export function printReportPdf(data: ReportQueryResponse, meta: ReportExportMeta, charts?: ReportChartImages): boolean {
  const html = buildReportPrintHtml(data, meta, charts)
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const blobUrl = URL.createObjectURL(blob)
  const popup = window.open(blobUrl, '_blank')

  if (popup) {
    const revokeTimer = window.setInterval(() => {
      if (popup.closed) {
        URL.revokeObjectURL(blobUrl)
        window.clearInterval(revokeTimer)
      }
    }, 500)

    return true
  }

  printHtmlViaIframe(blobUrl)

  return true
}

export function exportReportHtml(data: ReportQueryResponse, meta: ReportExportMeta, charts?: ReportChartImages) {
  const html = buildReportPrintHtml(data, meta, charts, { autoPrint: false })

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = `report-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export function groupByLabel(groupBy: string) {
  const labels: Record<string, string> = {
    stage: 'Stage',
    agent: 'Agent',
    customer: 'Customer',
    bank: 'Bank',
    loanType: 'Loan type',
    time: 'Time'
  }

  return labels[groupBy] ?? groupBy
}

export { formatINR, formatDate }
