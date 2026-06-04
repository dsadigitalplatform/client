'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import dynamic from 'next/dynamic'

import type { ApexOptions } from 'apexcharts'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'

import { listDisbursementTrackers } from '@features/loan-disbursements/services/loanDisbursementsService'
import type { DisbursementTrackerListItem } from '@features/loan-disbursements/loan-disbursements.types'
import type { DisbursementListSummary } from '@features/loan-disbursements/services/loanDisbursementsService'
import { filterByDashboardPeriod, type DashboardTimePeriod } from '@features/dashboard/utils/timelineBuckets'

const AppReactApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false })

const formatINR = (amount: number) => `₹ ${new Intl.NumberFormat('en-IN').format(Number.isFinite(amount) ? amount : 0)}`

const statusMeta = {
  PENDING: { label: 'Pending', color: '#94A3B8' },
  PARTIAL: { label: 'In progress', color: '#F59E0B' },
  COMPLETED: { label: 'Completed', color: '#22C55E' }
} as const

type Props = {
  enabled: boolean
  assignedAgentId?: string
  period: DashboardTimePeriod
}

function summarizeTrackers(trackers: DisbursementTrackerListItem[]): DisbursementListSummary {
  return trackers.reduce(
    (acc, t) => {
      acc.total += 1
      acc.totalDisbursed += t.totalDisbursedAmount
      if (t.disbursementStatus === 'PENDING') acc.pending += 1
      else if (t.disbursementStatus === 'PARTIAL') acc.partial += 1
      else if (t.disbursementStatus === 'COMPLETED') acc.completed += 1

      return acc
    },
    { total: 0, pending: 0, partial: 0, completed: 0, totalDisbursed: 0 }
  )
}

export default function DisbursementInsightsSection({ enabled, assignedAgentId, period }: Props) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackers, setTrackers] = useState<DisbursementTrackerListItem[]>([])

  useEffect(() => {
    let active = true

    if (!enabled) {
      setTrackers([])
      setLoading(false)
      setError(null)

      return () => {
        active = false
      }
    }

    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await listDisbursementTrackers(
          assignedAgentId ? { assignedAgentId } : undefined
        )

        if (!active) return
        setTrackers(res.trackers)
      } catch (e: unknown) {
        if (!active) return
        setError((e as Error)?.message || 'Failed to load disbursements')
        setTrackers([])
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()

    return () => {
      active = false
    }
  }, [enabled, assignedAgentId])

  const filteredTrackers = useMemo(
    () => filterByDashboardPeriod(trackers, t => (t.updatedAt ? new Date(t.updatedAt) : null), period),
    [trackers, period]
  )

  const filteredSummary = useMemo(() => summarizeTrackers(filteredTrackers), [filteredTrackers])

  const topTrackers = useMemo(
    () =>
      filteredTrackers
        .slice()
        .sort((a, b) => b.remainingAmount - a.remainingAmount)
        .slice(0, 5),
    [filteredTrackers]
  )

  const donutOptions: ApexOptions = useMemo(
    () => ({
      chart: { type: 'donut', fontFamily: 'inherit' },
      labels: ['Pending', 'In progress', 'Completed'],
      colors: [statusMeta.PENDING.color, statusMeta.PARTIAL.color, statusMeta.COMPLETED.color],
      legend: {
        position: 'bottom',
        fontSize: '12px',
        labels: { colors: 'var(--mui-palette-text-secondary)' }
      },
      dataLabels: { enabled: false },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name: { show: true, fontSize: '11px', color: 'var(--mui-palette-text-secondary)' },
              value: {
                show: true,
                fontSize: '18px',
                fontWeight: 700,
                color: 'var(--mui-palette-text-primary)',
                formatter: v => String(v)
              },
              total: {
                show: true,
                label: 'Trackers',
                fontSize: '11px',
                color: 'var(--mui-palette-text-secondary)',
                formatter: () => String(filteredSummary.total)
              }
            }
          }
        }
      },
      stroke: { width: 0 },
      tooltip: { y: { formatter: v => `${v} tracker(s)` } }
    }),
    [filteredSummary.total]
  )

  const donutSeries = [filteredSummary.pending, filteredSummary.partial, filteredSummary.completed]

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', overflow: 'hidden' }}>
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
          <Box>
            <Typography variant='h6' sx={{ fontWeight: 700 }}>
              Progressive disbursements
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Staged payouts, completion status, and outstanding balances
            </Typography>
          </Box>
          <Button component={Link} href='/progressive-disbursements' size='small' endIcon={<i className='ri-arrow-right-line' />}>
            View all
          </Button>
        </Box>

        {!enabled ? (
          <Typography variant='body2' color='text.secondary'>
            Select an organisation to view disbursement insights.
          </Typography>
        ) : error ? (
          <Typography variant='body2' color='error'>
            {error}
          </Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.1fr 1fr 1.2fr' }, gap: 2 }}>
            <Box
              sx={{
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                background: isDark
                  ? 'linear-gradient(160deg, rgb(var(--mui-palette-primary-mainChannel) / 0.2), transparent)'
                  : 'linear-gradient(160deg, rgb(var(--mui-palette-primary-mainChannel) / 0.08), transparent)'
              }}
            >
              <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                Total disbursed
              </Typography>
              <Typography variant='h4' sx={{ fontWeight: 800, mt: 0.5, color: 'primary.main' }}>
                {loading ? '…' : formatINR(filteredSummary.totalDisbursed)}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                <Chip size='small' label={`${filteredSummary.total} trackers`} variant='outlined' />
                <Chip size='small' color='warning' variant='outlined' label={`${filteredSummary.partial} in progress`} />
                <Chip size='small' color='success' variant='outlined' label={`${filteredSummary.completed} done`} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 220 }}>
              {loading ? (
                <Typography variant='body2' color='text.secondary'>
                  Loading chart…
                </Typography>
              ) : filteredSummary.total === 0 ? (
                <Box sx={{ textAlign: 'center', px: 2 }}>
                  <Avatar sx={{ width: 48, height: 48, mx: 'auto', mb: 1, bgcolor: 'action.hover' }}>
                    <i className='ri-pie-chart-2-line' />
                  </Avatar>
                  <Typography variant='body2' color='text.secondary'>
                    No trackers yet. Start from an eligible lead.
                  </Typography>
                </Box>
              ) : (
                <AppReactApexCharts type='donut' height={240} width='100%' options={donutOptions} series={donutSeries} />
              )}
            </Box>

            <Box>
              <Typography variant='subtitle2' sx={{ fontWeight: 700, mb: 1.25 }}>
                Highest remaining balance
              </Typography>
              {loading ? (
                <Typography variant='body2' color='text.secondary'>
                  Loading…
                </Typography>
              ) : topTrackers.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No active trackers to show.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {topTrackers.map(row => (
                    <Box
                      key={row.id}
                      component={Link}
                      href={`/progressive-disbursements/${row.id}`}
                      sx={{
                        display: 'block',
                        textDecoration: 'none',
                        color: 'inherit',
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        transition: 'background-color 120ms ease, border-color 120ms ease',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderColor: 'primary.light'
                        }
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                        <Typography variant='body2' fontWeight={600} noWrap>
                          {row.customerName}
                        </Typography>
                        <Typography variant='caption' color='text.secondary' noWrap>
                          {row.progressPercent}%
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant='determinate'
                        value={Math.min(100, Math.max(0, row.progressPercent))}
                        sx={{ height: 6, borderRadius: 99, mb: 0.75 }}
                      />
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography variant='caption' color='text.secondary'>
                          {formatINR(row.totalDisbursedAmount)} / {formatINR(row.approvedAmount)}
                        </Typography>
                        <Typography variant='caption' color='warning.main' fontWeight={600}>
                          {formatINR(row.remainingAmount)} left
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
