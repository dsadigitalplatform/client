'use client'

import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import dynamic from 'next/dynamic'

import type { ApexOptions } from 'apexcharts'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import {
  buildTimelineBuckets,
  formatDashboardPeriodLabel,
  isTimelineModeRecommended,
  suggestTimelineMode,
  timelineModeLabel,
  type TimelineMode
} from '@features/dashboard/utils/timelineBuckets'
import BreakdownApexChart, { type BreakdownPoint } from '@features/dashboard/components/BreakdownApexChart'
import {
  BreakdownChartControls,
  TimelineChartControls,
  type BreakdownChartType,
  type BreakdownMetric,
  type BreakdownSortOrder,
  type TopLimit
} from '@features/dashboard/components/DashboardChartToolbar'

const AppReactApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false })

type Props = {
  leads: LoanCaseListItem[]
  loading: boolean
  enabled: boolean
  /** Shown in timeline card subtitle when range is set globally */
  globalPeriodLabel?: string
}

const formatINR = (amount: number) => `₹ ${new Intl.NumberFormat('en-IN').format(Number.isFinite(amount) ? amount : 0)}`

const formatCompactINR = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number.isFinite(amount) ? amount : 0)

function aggregateBreakdown(
  leads: LoanCaseListItem[],
  pickLabel: (c: LoanCaseListItem) => string
): BreakdownPoint[] {
  const map = new Map<string, { value: number; count: number }>()

  leads.forEach(c => {
    const amount = typeof c.requestedAmount === 'number' ? c.requestedAmount : 0
    const label = pickLabel(c)

    const prev = map.get(label) || { value: 0, count: 0 }

    map.set(label, {
      value: prev.value + amount,
      count: prev.count + 1
    })
  })

  return Array.from(map.entries()).map(([label, v]) => ({ label, value: v.value, count: v.count }))
}

function TimelineApexChart({
  points,
  darkMode,
  accentColor
}: {
  points: { label: string; value: number }[]
  darkMode: boolean
  accentColor: string
}) {
  const labels = points.map(p => p.label)
  const values = points.map(p => p.value)

  const options: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: {
        show: true,
        tools: { download: true, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
      },
      zoom: { enabled: true },
      fontFamily: 'inherit'
    },
    colors: [accentColor],
    stroke: { curve: 'smooth', width: 2.8 },
    fill: {
      type: 'gradient',
      gradient: {
        shade: darkMode ? 'dark' : 'light',
        type: 'vertical',
        shadeIntensity: 0.25,
        opacityFrom: 0.45,
        opacityTo: 0.06,
        stops: [0, 95, 100]
      }
    },
    dataLabels: { enabled: false },
    markers: { size: 4, strokeWidth: 0, hover: { sizeOffset: 2 } },
    grid: {
      borderColor: darkMode ? 'rgb(var(--mui-palette-dividerChannel) / 0.35)' : 'rgb(var(--mui-palette-dividerChannel) / 0.55)',
      strokeDashArray: 4
    },
    xaxis: {
      categories: labels,
      labels: {
        style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '11px' },
        rotate: -18,
        hideOverlappingLabels: true
      }
    },
    yaxis: {
      labels: {
        style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '11px' },
        formatter: value => formatAxisAmount(Number(value))
      }
    },
    tooltip: {
      x: { show: true },
      y: { formatter: value => formatINR(Number(value || 0)) }
    }
  }

  return (
    <AppReactApexCharts
      type='area'
      height={260}
      options={options}
      series={[{ name: 'Loan amount', data: values }]}
    />
  )
}

function AnalyticsCard({
  title,
  subtitle,
  totalLabel,
  totalValue,
  icon,
  accent,
  controls,
  children,
  footer
}: {
  title: string
  subtitle: string
  totalLabel: string
  totalValue: string
  icon: string
  accent: string
  controls?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'action.hover',
                    color: accent
                  }}
                >
                  <i className={icon} />
                </Box>
                <Box>
                  <Typography variant='subtitle1' sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                    {title}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {subtitle}
                  </Typography>
                </Box>
              </Box>
              <Typography variant='h6' sx={{ fontWeight: 800, mt: 1 }}>
                {totalValue}
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                {totalLabel}
              </Typography>
            </Box>
          </Box>
          {controls ? <Box sx={{ width: '100%', minWidth: 0 }}>{controls}</Box> : null}
        </Box>
        <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
        {footer ? <Box sx={{ mt: 1 }}>{footer}</Box> : null}
      </CardContent>
    </Card>
  )
}

export default function DashboardAnalyticsSection({ leads, loading, enabled, globalPeriodLabel }: Props) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [bankChartType, setBankChartType] = useState<BreakdownChartType>('horizontal')
  const [loanTypeChartType, setLoanTypeChartType] = useState<BreakdownChartType>('bar')
  const [bankMetric, setBankMetric] = useState<BreakdownMetric>('amount')
  const [loanTypeMetric, setLoanTypeMetric] = useState<BreakdownMetric>('amount')
  const [bankTop, setBankTop] = useState<TopLimit>(8)
  const [loanTypeTop, setLoanTypeTop] = useState<TopLimit>(8)
  const [bankSort, setBankSort] = useState<BreakdownSortOrder>('desc')
  const [loanTypeSort, setLoanTypeSort] = useState<BreakdownSortOrder>('desc')

  const [timelineMode, setTimelineMode] = useState<TimelineMode>('WEEK')
  const [timelineModeManual, setTimelineModeManual] = useState(false)

  const datedAmounts = useMemo(() => {
    return leads
      .map(c => {
        const amount = typeof c.requestedAmount === 'number' ? c.requestedAmount : 0
        const date = c.updatedAt ? new Date(c.updatedAt) : null

        if (!date || !Number.isFinite(date.getTime()) || amount <= 0) return null

        return { date, amount }
      })
      .filter(Boolean) as Array<{ date: Date; amount: number }>
  }, [leads])

  const suggestedMode = useMemo(() => suggestTimelineMode(datedAmounts), [datedAmounts])

  useEffect(() => {
    if (timelineModeManual || datedAmounts.length === 0) return

    const rank: Record<TimelineMode, number> = { WEEK: 0, MONTH: 1, YEAR: 2 }

    if (rank[suggestedMode] > rank[timelineMode]) setTimelineMode(suggestedMode)
  }, [datedAmounts, suggestedMode, timelineMode, timelineModeManual])

  useEffect(() => {
    setTimelineModeManual(false)
  }, [leads])

  const timelinePoints = useMemo(
    () => buildTimelineBuckets(datedAmounts, timelineMode),
    [datedAmounts, timelineMode]
  )

  const bankRows = useMemo(
    () => aggregateBreakdown(leads, c => String(c.bankName || '').trim() || 'Unspecified bank'),
    [leads]
  )

  const loanTypeRows = useMemo(
    () => aggregateBreakdown(leads, c => String(c.loanTypeName || '').trim() || 'Unspecified loan type'),
    [leads]
  )

  const sortAndSlice = (rows: BreakdownPoint[], metric: BreakdownMetric, top: TopLimit, sort: BreakdownSortOrder) => {
    const key = metric === 'amount' ? 'value' : 'count'
    const sorted =
      sort === 'pipeline'
        ? rows.slice()
        : rows.slice().sort((a, b) => {
            if (sort === 'name') return a.label.localeCompare(b.label)
            if (sort === 'asc') return a[key] - b[key]

            return b[key] - a[key]
          })

    if (top === 0) return sorted

    return sorted.slice(0, top)
  }

  const bankDisplay = useMemo(
    () => sortAndSlice(bankRows.filter(r => (bankMetric === 'amount' ? r.value > 0 : r.count > 0)), bankMetric, bankTop, bankSort),
    [bankRows, bankMetric, bankTop, bankSort]
  )

  const loanTypeDisplay = useMemo(
    () =>
      sortAndSlice(
        loanTypeRows.filter(r => (loanTypeMetric === 'amount' ? r.value > 0 : r.count > 0)),
        loanTypeMetric,
        loanTypeTop,
        loanTypeSort
      ),
    [loanTypeRows, loanTypeMetric, loanTypeTop, loanTypeSort]
  )

  const bankTotal = useMemo(() => bankRows.reduce((s, r) => s + r.value, 0), [bankRows])
  const loanTypeTotal = useMemo(() => loanTypeRows.reduce((s, r) => s + r.value, 0), [loanTypeRows])
  const timelineTotal = useMemo(() => timelinePoints.reduce((s, p) => s + p.value, 0), [timelinePoints])

  const emptyState = (message: string) => (
    <Typography variant='body2' color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
      {message}
    </Typography>
  )

  const timelineControls = (
    <TimelineChartControls
      timelineMode={timelineMode}
      onTimelineMode={mode => {
        setTimelineModeManual(true)
        setTimelineMode(mode)
      }}
      suggestedMode={suggestedMode}
      datedFiltered={datedAmounts}
      showRangeControl={false}
    />
  )

  const periodHint = globalPeriodLabel || formatDashboardPeriodLabel({ mode: 'months', months: 12 })

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' },
        gap: 2
      }}
    >
      <AnalyticsCard
        title='Bank-wise loans'
        subtitle='Distribution by lending bank'
        totalLabel={`${bankRows.length} banks · amount basis`}
        totalValue={enabled ? (loading ? '…' : formatINR(bankTotal)) : '—'}
        icon='ri-bank-line'
        accent='var(--mui-palette-primary-main)'
        controls={
          <BreakdownChartControls
            chartType={bankChartType}
            onChartType={setBankChartType}
            metric={bankMetric}
            onMetric={setBankMetric}
            topLimit={bankTop}
            onTopLimit={setBankTop}
            sortOrder={bankSort}
            onSortOrder={setBankSort}
          />
        }
        footer={
          bankDisplay[0] ? (
            <Typography variant='caption' color='text.secondary'>
              Leading: {bankDisplay[0].label} ·{' '}
              {bankMetric === 'amount' ? formatCompactINR(bankDisplay[0].value) : `${bankDisplay[0].count} cases`}
            </Typography>
          ) : null
        }
      >
        {!enabled
          ? emptyState('Select an organisation')
          : loading
            ? emptyState('Loading bank analytics…')
            : bankDisplay.length === 0
              ? emptyState('No bank data for current filters')
              : (
                <BreakdownApexChart
                  points={bankDisplay}
                  chartType={bankChartType}
                  metric={bankMetric}
                  accentColor={theme.palette.primary.main}
                  darkMode={isDark}
                />
              )}
      </AnalyticsCard>

      <AnalyticsCard
        title='Loan type mix'
        subtitle='Volume by product type'
        totalLabel={`${loanTypeRows.length} types`}
        totalValue={enabled ? (loading ? '…' : formatINR(loanTypeTotal)) : '—'}
        icon='ri-file-chart-line'
        accent='var(--mui-palette-success-main)'
        controls={
          <BreakdownChartControls
            chartType={loanTypeChartType}
            onChartType={setLoanTypeChartType}
            metric={loanTypeMetric}
            onMetric={setLoanTypeMetric}
            topLimit={loanTypeTop}
            onTopLimit={setLoanTypeTop}
            sortOrder={loanTypeSort}
            onSortOrder={setLoanTypeSort}
          />
        }
        footer={
          loanTypeDisplay[0] ? (
            <Typography variant='caption' color='text.secondary'>
              Top: {loanTypeDisplay[0].label} ·{' '}
              {loanTypeMetric === 'amount' ? formatCompactINR(loanTypeDisplay[0].value) : `${loanTypeDisplay[0].count} cases`}
            </Typography>
          ) : null
        }
      >
        {!enabled
          ? emptyState('Select an organisation')
          : loading
            ? emptyState('Loading loan types…')
            : loanTypeDisplay.length === 0
              ? emptyState('No loan type data')
              : (
                <BreakdownApexChart
                  points={loanTypeDisplay}
                  chartType={loanTypeChartType}
                  metric={loanTypeMetric}
                  accentColor={theme.palette.success.main}
                  darkMode={isDark}
                />
              )}
      </AnalyticsCard>

      <AnalyticsCard
        title='Loan amount timeline'
        subtitle={`${periodHint} · ${timelineModeLabel(timelineMode).toLowerCase()} buckets`}
        totalLabel={
          timelinePoints.length > 0
            ? `${timelinePoints[0]?.label} → ${timelinePoints[timelinePoints.length - 1]?.label}`
            : 'Activity by period'
        }
        totalValue={enabled ? (loading ? '…' : formatINR(timelineTotal)) : '—'}
        icon='ri-line-chart-line'
        accent='var(--mui-palette-info-main)'
        controls={timelineControls}
        footer={
          !timelineModeManual && suggestedMode !== 'WEEK' ? (
            <Typography variant='caption' color='text.secondary'>
              Showing {timelineModeLabel(timelineMode).toLowerCase()} view — switch to Week for recent pipeline rhythm.
            </Typography>
          ) : null
        }
      >
        {!enabled
          ? emptyState('Select an organisation')
          : loading
            ? emptyState('Loading timeline…')
            : timelinePoints.length === 0
              ? emptyState('No dated loan amounts in this range')
              : (
                <TimelineApexChart
                  points={timelinePoints}
                  darkMode={isDark}
                  accentColor={theme.palette.info.main}
                />
              )}
      </AnalyticsCard>
    </Box>
  )
}
