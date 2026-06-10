'use client'

import { useMemo, useState } from 'react'

import dynamic from 'next/dynamic'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import { useColorScheme, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { ApexOptions } from 'apexcharts'

import BreakdownApexChart, { type BreakdownPoint } from '@features/dashboard/components/BreakdownApexChart'
import {
  BreakdownChartControls,
  type BreakdownChartType,
  type BreakdownMetric,
  type BreakdownSortOrder,
  type TopLimit
} from '@features/dashboard/components/DashboardChartToolbar'

import type { ReportMetric, ReportQueryResponse } from '../reports.types'
import { groupByLabel } from '../utils/exportReport'

const AppReactApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false })

type Props = {
  data: ReportQueryResponse
}

function sortBreakdown(points: BreakdownPoint[], order: BreakdownSortOrder, pipelineOrder?: Map<string, number>) {
  const copy = [...points]

  if (order === 'pipeline' && pipelineOrder) {
    copy.sort((a, b) => (pipelineOrder.get(a.label) ?? 999) - (pipelineOrder.get(b.label) ?? 999))

    return copy
  }

  if (order === 'name') {
    copy.sort((a, b) => a.label.localeCompare(b.label))

    return copy
  }

  copy.sort((a, b) => (order === 'asc' ? a.count - b.count : b.count - a.count))

  return copy
}

export default function ReportsChartSection({ data }: Props) {
  const theme = useTheme()
  const { mode } = useColorScheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const darkMode = mode === 'dark'

  const [breakdownChartType, setBreakdownChartType] = useState<BreakdownChartType>(isMobile ? 'horizontal' : 'bar')
  const [breakdownMetric, setBreakdownMetric] = useState<BreakdownMetric>(data.metric === 'amount' ? 'amount' : 'count')
  const [topLimit, setTopLimit] = useState<TopLimit>(8)
  const [sortOrder, setSortOrder] = useState<BreakdownSortOrder>(data.groupBy === 'stage' ? 'pipeline' : 'desc')

  const breakdownPoints: BreakdownPoint[] = useMemo(
    () =>
      data.breakdown.map(row => ({
        label: row.label,
        value: row.amount,
        count: row.count
      })),
    [data.breakdown]
  )

  const pipelineOrder = useMemo(() => {
    const map = new Map<string, number>()

    data.breakdown.forEach(row => {
      if (row.order != null) map.set(row.label, row.order)
    })

    return map
  }, [data.breakdown])

  const visibleBreakdown = useMemo(() => {
    let sorted = sortBreakdown(breakdownPoints, sortOrder, pipelineOrder)

    if (topLimit > 0) sorted = sorted.slice(0, topLimit)

    return sorted
  }, [breakdownPoints, sortOrder, pipelineOrder, topLimit])

  const trendOptions: ApexOptions = useMemo(() => {
    const metric = data.metric
    const categories = data.trend.map(t => t.label)

    return {
      chart: { type: 'area', toolbar: { show: !isMobile }, fontFamily: 'inherit' },
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: { shadeIntensity: 0.4, opacityFrom: 0.45, opacityTo: 0.05 }
      },
      colors: [theme.palette.primary.main],
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        labels: { style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '10px' }, rotate: -25 }
      },
      yaxis: {
        labels: {
          style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '10px' },
          formatter: val =>
            metric === 'amount'
              ? `₹${new Intl.NumberFormat('en-IN', { notation: 'compact' }).format(Number(val))}`
              : String(Math.round(Number(val)))
        }
      },
      tooltip: {
        y: {
          formatter: val =>
            metric === 'amount'
              ? `₹ ${new Intl.NumberFormat('en-IN').format(Number(val))}`
              : `${val} cases`
        }
      },
      grid: { borderColor: 'divider', strokeDashArray: 4 }
    }
  }, [data.trend, data.metric, isMobile, theme.palette.primary.main])

  const showBreakdown = data.breakdown.length > 0 && data.view !== 'trend'
  const showTrend = data.trend.length > 0 && data.view !== 'summary' && data.view !== 'detailed'

  if (!showBreakdown && !showTrend) return null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {showBreakdown ? (
        <Card variant='outlined'>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant='h6' data-report-chart-title>
                Breakdown by {groupByLabel(data.groupBy)}
              </Typography>
              <BreakdownChartControls
                chartType={breakdownChartType}
                onChartType={setBreakdownChartType}
                metric={breakdownMetric}
                onMetric={setBreakdownMetric}
                topLimit={topLimit}
                onTopLimit={setTopLimit}
                sortOrder={sortOrder}
                onSortOrder={setSortOrder}
                sortOptions={data.groupBy === 'stage' ? ['pipeline', 'desc', 'asc', 'name'] : ['desc', 'asc', 'name']}
              />
              <Box data-report-chart='breakdown' sx={{ width: '100%', minHeight: 200 }}>
                <BreakdownApexChart
                  points={visibleBreakdown}
                  chartType={breakdownChartType}
                  metric={breakdownMetric}
                  accentColor={theme.palette.primary.main}
                  darkMode={darkMode}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      {showTrend ? (
        <Card variant='outlined'>
          <CardContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant='h6' data-report-chart-title>
                {data.dataMode === 'historical' ? 'Stage movement trend' : 'Lead creation trend'}
              </Typography>
              <Box data-report-chart='trend' sx={{ width: '100%', minHeight: 220 }}>
                <AppReactApexCharts
                  type='area'
                  height={isMobile ? 220 : 280}
                  options={trendOptions}
                  series={[
                    {
                      name: (data.metric as ReportMetric) === 'amount' ? 'Amount' : 'Cases',
                      data: data.trend.map(t => ((data.metric as ReportMetric) === 'amount' ? t.amount : t.count))
                    }
                  ]}
                />
              </Box>
            </Box>
          </CardContent>
        </Card>
      ) : null}
    </Box>
  )
}
