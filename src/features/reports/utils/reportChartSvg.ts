import type { ReportChartImages, ReportChartImage } from './captureReportCharts'
import type { ReportMetric, ReportQueryResponse } from '../reports.types'

const BAR_COLORS = ['#7C6CF8', '#21A8FF', '#46C95A', '#F4A261', '#EF476F', '#14B8A6', '#F472B6', '#6C757D']

function groupByLabel(groupBy: string) {
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

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function formatCompact(value: number, metric: ReportMetric) {
  if (metric === 'amount') {
    return `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`
  }

  return String(Math.round(value))
}

function buildBreakdownSvg(data: ReportQueryResponse, metric: ReportMetric): string {
  const rows = data.breakdown.slice(0, 10)

  if (rows.length === 0) return ''

  const values = rows.map(r => (metric === 'amount' ? r.amount : r.count))
  const max = Math.max(...values, 1)
  const barHeight = 28
  const gap = 10
  const labelWidth = 140
  const chartWidth = 520
  const height = rows.length * (barHeight + gap) + 40
  const width = labelWidth + chartWidth + 80

  const bars = rows
    .map((row, index) => {
      const value = metric === 'amount' ? row.amount : row.count
      const barWidth = Math.max(4, (value / max) * chartWidth)
      const y = 24 + index * (barHeight + gap)
      const color = BAR_COLORS[index % BAR_COLORS.length]
      const label = row.label.length > 18 ? `${row.label.slice(0, 17)}…` : row.label

      return `
        <text x="8" y="${y + 18}" font-size="11" fill="#444">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>
        <rect x="${labelWidth}" y="${y}" width="${barWidth}" height="${barHeight}" rx="6" fill="${color}" />
        <text x="${labelWidth + barWidth + 8}" y="${y + 18}" font-size="11" fill="#222" font-weight="600">${formatCompact(value, metric)}</text>
      `
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    ${bars}
  </svg>`
}

function buildTrendSvg(data: ReportQueryResponse, metric: ReportMetric): string {
  const rows = data.trend

  if (rows.length === 0) return ''

  const values = rows.map(r => (metric === 'amount' ? r.amount : r.count))
  const max = Math.max(...values, 1)
  const width = 720
  const height = 280
  const padLeft = 48
  const padRight = 24
  const padTop = 24
  const padBottom = 48
  const innerW = width - padLeft - padRight
  const innerH = height - padTop - padBottom

  const points = values
    .map((value, index) => {
      const x = padLeft + (values.length === 1 ? innerW / 2 : (index / (values.length - 1)) * innerW)
      const y = padTop + innerH - (value / max) * innerH

      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `${padLeft},${padTop + innerH} ${points} ${padLeft + innerW},${padTop + innerH}`

  const labels = rows
    .map((row, index) => {
      if (rows.length > 8 && index % 2 !== 0 && index !== rows.length - 1) return ''

      const x = padLeft + (rows.length === 1 ? innerW / 2 : (index / (rows.length - 1)) * innerW)
      const label = row.label.length > 10 ? `${row.label.slice(0, 9)}…` : row.label

      return `<text x="${x}" y="${height - 12}" font-size="10" fill="#666" text-anchor="middle">${label.replace(/&/g, '&amp;')}</text>`
    })
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <line x1="${padLeft}" y1="${padTop + innerH}" x2="${padLeft + innerW}" y2="${padTop + innerH}" stroke="#ddd"/>
    <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${padTop + innerH}" stroke="#ddd"/>
    <polygon points="${areaPoints}" fill="#7C6CF8" fill-opacity="0.18"/>
    <polyline points="${points}" fill="none" stroke="#7C6CF8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${labels}
  </svg>`
}

export function buildFallbackChartImages(data: ReportQueryResponse): ReportChartImages {
  const metric = data.metric
  const result: ReportChartImages = {}

  const showBreakdown = data.breakdown.length > 0 && data.view !== 'trend'
  const showTrend = data.trend.length > 0 && data.view !== 'summary' && data.view !== 'detailed'

  if (showBreakdown) {
    const svg = buildBreakdownSvg(data, metric)

    if (svg) {
      result.breakdown = {
        title: `Breakdown by ${groupByLabel(data.groupBy)}`,
        dataUrl: svgToDataUrl(svg)
      }
    }
  }

  if (showTrend) {
    const svg = buildTrendSvg(data, metric)

    if (svg) {
      result.trend = {
        title: data.dataMode === 'historical' ? 'Stage movement trend' : 'Lead creation trend',
        dataUrl: svgToDataUrl(svg)
      }
    }
  }

  return result
}

export function mergeChartImages(
  captured: ReportChartImages,
  fallback: ReportChartImages
): ReportChartImages {
  return {
    breakdown: captured.breakdown ?? fallback.breakdown,
    trend: captured.trend ?? fallback.trend
  }
}

export function hasChartImages(charts: ReportChartImages) {
  return Boolean(charts.breakdown || charts.trend)
}

export function chartImagesToHtml(charts: ReportChartImages): string {
  const blocks: ReportChartImage[] = []

  if (charts.breakdown) blocks.push(charts.breakdown)
  if (charts.trend) blocks.push(charts.trend)

  if (blocks.length === 0) return ''

  return `
    <section class="charts">
      <h2>Charts</h2>
      ${blocks
        .map(
          chart => `
        <div class="chart-block">
          <h3>${chart.title.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</h3>
          <img src="${chart.dataUrl}" alt="${chart.title.replace(/"/g, '&quot;')}" class="chart-img" />
        </div>`
        )
        .join('')}
    </section>`
}
