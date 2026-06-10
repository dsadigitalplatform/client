import type { ReportExportMeta, ReportQueryResponse } from '../reports.types'
import type { ReportChartImages } from './captureReportCharts'
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
    const isHistorical = data.dataMode === 'historical'

    rows.push(
      isHistorical
        ? ['Customer', 'Loan type', 'Bank', 'Stage (audit)', 'Staged date', 'Agent', 'Amount', 'Lead created']
        : ['Customer', 'Loan type', 'Bank', 'Stage', 'Agent', 'Amount', 'Created']
    )

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
  }

  const csv = `\uFEFF${rows.map(r => r.map(escapeCsvCell).join(',')).join('\n')}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')

  a.href = url
  a.download = `report-${new Date().toISOString().slice(0, 10)}.csv`
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
      ? `<h2>Detailed rows (${data.details.length}${data.details.length >= 500 ? ', max 500 shown' : ''})</h2><table><thead><tr>${
          isHistorical
            ? '<th>Customer</th><th>Loan type</th><th>Bank</th><th>Stage (audit)</th><th>Staged date</th><th>Agent</th><th>Amount</th>'
            : '<th>Customer</th><th>Loan type</th><th>Bank</th><th>Stage</th><th>Agent</th><th>Amount</th><th>Created</th>'
        }</tr></thead><tbody>${data.details
          .map(row =>
            isHistorical
              ? `<tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.loanTypeName)}</td><td>${escapeHtml(row.bankName)}</td><td>${escapeHtml(row.auditStageName ?? row.stageName)}</td><td>${escapeHtml(row.auditStagedDate)}</td><td>${escapeHtml(row.agentName)}</td><td>${escapeHtml(formatINR(row.requestedAmount))}</td></tr>`
              : `<tr><td>${escapeHtml(row.customerName)}</td><td>${escapeHtml(row.loanTypeName)}</td><td>${escapeHtml(row.bankName)}</td><td>${escapeHtml(row.stageName)}</td><td>${escapeHtml(row.agentName)}</td><td>${escapeHtml(formatINR(row.requestedAmount))}</td><td>${escapeHtml(formatDate(row.createdAt))}</td></tr>`
          )
          .join('')}</tbody></table>`
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
