'use client'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import type { MonthlyPerformanceData } from '@features/dashboard/dashboard.types'

const formatINR = (amount: number) => {
  const safe = Number.isFinite(amount) ? amount : 0

  return `₹ ${safe.toLocaleString('en-IN')}`
}

const formatMonthRange = (dateFrom: string, dateTo: string) => {
  const from = new Date(`${dateFrom}T00:00:00`)
  const to = new Date(`${dateTo}T00:00:00`)

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return `${dateFrom} to ${dateTo}`
  }

  const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' })
  const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric' })

  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${monthFmt.format(from)} · ${dayFmt.format(from)}–${dayFmt.format(to)}`
  }

  return `${dateFrom} to ${dateTo}`
}

type MetricPanelProps = {
  title: string
  subtitle: string
  icon: string
  accent: 'info' | 'success'
  totalCases: number
  totalAmount: number
  configured: boolean
  stageName: string | null
  missingMessage: string
}

function MetricPanel({
  title,
  subtitle,
  icon,
  accent,
  totalCases,
  totalAmount,
  configured,
  stageName,
  missingMessage
}: MetricPanelProps) {
  const theme = useTheme()
  const palette = accent === 'info' ? theme.palette.info : theme.palette.success
  const bg = alpha(palette.main, theme.palette.mode === 'dark' ? 0.16 : 0.08)
  const border = alpha(palette.main, 0.28)

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: border,
        background: `linear-gradient(145deg, ${bg} 0%, transparent 100%)`
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box
              component='span'
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: 2,
                backgroundColor: bg,
                color: `${accent}.main`,
                '& i': { fontSize: '1.1rem' }
              }}
            >
              <i className={icon} />
            </Box>
            <Typography variant='subtitle2' sx={{ fontWeight: 800, letterSpacing: 0.2 }}>
              {title}
            </Typography>
          </Box>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
            {configured && stageName ? `${stageName} · ${subtitle}` : subtitle}
          </Typography>
        </Box>
      </Box>

      {!configured ? (
        <Typography variant='body2' color='text.secondary' sx={{ py: 1 }}>
          {missingMessage}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography variant='h4' sx={{ fontWeight: 900, color: `${accent}.main`, lineHeight: 1.1 }}>
              {totalCases.toLocaleString()}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 600 }}>
              {totalCases === 1 ? 'case' : 'cases'}
            </Typography>
          </Box>
          <Typography variant='h6' sx={{ fontWeight: 800, mt: 0.75 }}>
            {formatINR(totalAmount)}
          </Typography>
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
            Requested loan volume
          </Typography>
        </>
      )}
    </Box>
  )
}

type Props = {
  enabled: boolean
  loading: boolean
  error: string | null
  data: MonthlyPerformanceData | null
  onRefresh?: () => void
  compact?: boolean
}

export default function MonthlyPerformanceSection({ enabled, loading, error, data, onRefresh, compact }: Props) {
  const rangeLabel =
    data?.dateFrom && data?.dateTo ? formatMonthRange(data.dateFrom, data.dateTo) : 'Current month · stage history'

  const body = !enabled ? (
    <Typography variant='body2' color='text.secondary'>
      Select an organization to view monthly logged-in and disbursed metrics.
    </Typography>
  ) : loading ? (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, py: compact ? 2 : 4 }}>
      <CircularProgress size={28} thickness={4} />
      <Typography variant='body2' color='text.secondary'>
        Loading monthly performance…
      </Typography>
    </Box>
  ) : error ? (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant='body2' color='error.main' sx={{ fontWeight: 700 }}>
        {error}
      </Typography>
      {onRefresh ? (
        <Button size='small' variant='outlined' onClick={onRefresh}>
          Retry
        </Button>
      ) : null}
    </Box>
  ) : !data ? (
    <Typography variant='body2' color='text.secondary'>
      No monthly performance data available.
    </Typography>
  ) : (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
        gap: 2
      }}
    >
      <MetricPanel
        title='Monthly Logged-In'
        subtitle='Stage history this month'
        icon='ri-login-circle-line'
        accent='info'
        totalCases={data.loggedIn.totalCases}
        totalAmount={data.loggedIn.totalAmount}
        configured={data.loggedIn.configured}
        stageName={data.loggedIn.stageName}
        missingMessage='No Logged In stage is configured. Mark a stage under Loan Status Pipeline.'
      />
      <MetricPanel
        title='Monthly Disbursed'
        subtitle='Stage history this month'
        icon='ri-money-rupee-circle-line'
        accent='success'
        totalCases={data.disbursed.totalCases}
        totalAmount={data.disbursed.totalAmount}
        configured={data.disbursed.configured}
        stageName={data.disbursed.stageName}
        missingMessage='No Disbursed stage is configured. Mark a stage under Loan Status Pipeline.'
      />
    </Box>
  )

  if (compact) {
    return body
  }

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 2
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant='h6' sx={{ fontWeight: 700 }}>
              Monthly performance
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Logged-in and disbursed cases from stage audit history · {rangeLabel}
            </Typography>
          </Box>
          <Button
            component={Link}
            href='/reports'
            size='small'
            variant='outlined'
            startIcon={<i className='ri-bar-chart-box-line' />}
            sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-start' }, flexShrink: 0 }}
          >
            Open reports
          </Button>
        </Box>
        <Divider sx={{ mb: 2 }} />
        {body}
      </CardContent>
    </Card>
  )
}
