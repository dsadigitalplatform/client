'use client'

import dynamic from 'next/dynamic'

import type { ApexOptions } from 'apexcharts'

import type { BreakdownChartType, BreakdownMetric } from '@features/dashboard/components/DashboardChartToolbar'

const AppReactApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false })

export type BreakdownPoint = { label: string; value: number; count: number }

const formatINR = (amount: number) => `₹ ${new Intl.NumberFormat('en-IN').format(Number.isFinite(amount) ? amount : 0)}`

const formatCompactINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number.isFinite(amount) ? amount : 0)

const formatAxisAmount = (value: number) => {
  const safe = Number.isFinite(value) ? value : 0

  return `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(safe)}`
}

const BAR_PALETTE_LIGHT = ['#7C6CF8', '#21A8FF', '#46C95A', '#F4A261', '#EF476F', '#6C757D', '#14B8A6', '#F472B6']
const BAR_PALETTE_DARK = ['#A493FF', '#73C8FF', '#78E08F', '#FFC385', '#FF89A0', '#B5BDC6', '#5EEAD4', '#F9A8D4']

const HORIZONTAL_ROW_PX = 36
const HORIZONTAL_MAX_HEIGHT = 280

type Props = {
  points: BreakdownPoint[]
  chartType: BreakdownChartType
  metric: BreakdownMetric
  accentColor: string
  darkMode: boolean
}

export default function BreakdownApexChart({
  points,
  chartType,
  metric,
  accentColor,
  darkMode
}: Props) {
  const palette = darkMode ? BAR_PALETTE_DARK : BAR_PALETTE_LIGHT
  const categories = points.map(p => p.label)
  const seriesValues = points.map(p => {
    const raw = metric === 'amount' ? p.value : p.count

    return Number.isFinite(raw) ? raw : 0
  })
  const total = seriesValues.reduce((s, v) => s + v, 0)

  if (chartType === 'donut') {
    const options: ApexOptions = {
      chart: { type: 'donut', fontFamily: 'inherit' },
      labels: categories,
      colors: palette,
      legend: {
        position: 'bottom',
        fontSize: '11px',
        labels: { colors: 'var(--mui-palette-text-secondary)' }
      },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '68%',
            labels: {
              show: true,
              total: {
                show: true,
                label: metric === 'amount' ? 'Total' : 'Cases',
                formatter: () => (metric === 'amount' ? formatCompactINR(total) : String(total))
              }
            }
          }
        }
      },
      tooltip: {
        y: {
          formatter: (val, opts) => {
            const pct = total > 0 ? Math.round((Number(val) / total) * 100) : 0
            const row = points[opts?.seriesIndex ?? 0]

            return metric === 'amount'
              ? `${formatINR(Number(val))} (${pct}%) · ${row?.count ?? 0} cases`
              : `${val} cases (${pct}%)`
          }
        }
      }
    }

    return <AppReactApexCharts type='donut' height={260} options={options} series={seriesValues} />
  }

  const horizontal = chartType === 'horizontal'

  const valueAxisFormatter = (value: string | number) => {
    const n = Number(value)

    if (!Number.isFinite(n)) return ''

    return metric === 'amount' ? formatAxisAmount(n) : String(Math.round(n))
  }

  const options: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: {
        show: true,
        tools: { download: true, selection: false, zoom: false, zoomin: false, zoomout: false, pan: false, reset: false }
      },
      fontFamily: 'inherit'
    },
    colors: palette,
    plotOptions: {
      bar: {
        horizontal,
        distributed: true,
        borderRadius: 6,
        columnWidth: horizontal ? undefined : '58%',
        barHeight: horizontal ? (points.length > 7 ? '55%' : '68%') : undefined
      }
    },
    dataLabels: {
      enabled: horizontal,
      formatter: val => {
        const n = Number(val)

        return metric === 'amount' ? formatCompactINR(n) : String(Math.round(n))
      },
      style: { fontSize: '10px', fontWeight: 600 }
    },
    legend: { show: false },
    grid: {
      borderColor: darkMode ? 'rgb(var(--mui-palette-dividerChannel) / 0.35)' : 'rgb(var(--mui-palette-dividerChannel) / 0.55)',
      strokeDashArray: 4,
      padding: { left: horizontal ? 8 : 0, right: 8, top: 0, bottom: 0 }
    },
    xaxis: {
      categories,
      labels: {
        style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '10px' },
        rotate: horizontal ? 0 : -22,
        trim: true,
        hideOverlappingLabels: true,
        ...(horizontal ? { formatter: value => valueAxisFormatter(value) } : {})
      }
    },
    yaxis: {
      labels: {
        style: {
          colors: horizontal ? 'var(--mui-palette-text-primary)' : 'var(--mui-palette-text-secondary)',
          fontSize: '11px',
          fontWeight: horizontal ? 600 : 400,
          maxWidth: horizontal ? 160 : undefined
        },
        ...(horizontal
          ? {}
          : {
              formatter: value => valueAxisFormatter(value)
            })
      }
    },
    tooltip: {
      ...(horizontal
        ? {
            x: {
              formatter: (val, opts) => {
                const row = points[opts?.dataPointIndex ?? 0]
                const pct = total > 0 ? Math.round((Number(val) / total) * 100) : 0

                return metric === 'amount'
                  ? `${formatINR(Number(val))} (${pct}%) · ${row?.count ?? 0} cases`
                  : `${val} cases (${pct}%)`
              }
            }
          }
        : {
            y: {
              formatter: (val, opts) => {
                const row = points[opts?.dataPointIndex ?? 0]
                const pct = total > 0 ? Math.round((Number(val) / total) * 100) : 0

                return metric === 'amount'
                  ? `${formatINR(Number(val))} (${pct}%) · ${row?.count ?? 0} cases`
                  : `${val} cases (${pct}%)`
              }
            }
          })
    }
  }

  const height = horizontal
    ? Math.min(HORIZONTAL_MAX_HEIGHT, Math.max(200, points.length * HORIZONTAL_ROW_PX))
    : 240

  return (
    <AppReactApexCharts
      type='bar'
      height={height}
      options={options}
      series={[{ name: metric === 'amount' ? 'Amount' : 'Cases', data: seriesValues }]}
    />
  )
}
