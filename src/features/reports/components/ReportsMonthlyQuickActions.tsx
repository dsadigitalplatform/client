'use client'

import { useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import type { ReportFilterOptions, ReportFilters } from '../reports.types'
import {
  buildMonthlyDisbursedReportFilters,
  buildMonthlyStageReportFilters,
  detectMonthlyReportType,
  findLoggedInStageIds,
  formatMonthLabel,
  formatMonthRangeCaption,
  getCurrentMonthRef,
  isCurrentMonthRef,
  isFutureMonthRef,
  isMonthlyDisbursedFilters,
  isMonthlyLoggedInFilters,
  parseMonthRefFromFilters,
  shiftMonthRef,
  type MonthRef
} from '../utils/monthlyReportHelpers'

type Props = {
  filters: ReportFilters
  filterOptions: ReportFilterOptions | null
  loading: boolean
  disabled?: boolean
  onApply: (filters: ReportFilters) => void
}

export default function ReportsMonthlyQuickActions({ filters, filterOptions, loading, disabled = false, onApply }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [error, setError] = useState<string | null>(null)
  const [navMonth, setNavMonth] = useState<MonthRef>(() => getCurrentMonthRef())

  const loggedInStageIds = useMemo(
    () => (filterOptions ? findLoggedInStageIds(filterOptions.stages) : []),
    [filterOptions]
  )

  const loggedInActive = useMemo(
    () => Boolean(filterOptions && isMonthlyLoggedInFilters(filters, filterOptions.stages)),
    [filterOptions, filters]
  )

  const disbursedActive = useMemo(
    () => Boolean(filterOptions && isMonthlyDisbursedFilters(filters, filterOptions.stages)),
    [filterOptions, filters]
  )

  const monthlyActive = loggedInActive || disbursedActive
  const isThisMonth = isCurrentMonthRef(navMonth)
  const canGoForward = !isThisMonth
  const monthLabel = formatMonthLabel(navMonth)
  const rangeCaption = formatMonthRangeCaption(navMonth)

  useEffect(() => {
    const parsed = parseMonthRefFromFilters(filters)

    if (parsed) {
      setNavMonth(parsed)
    }
  }, [filters])

  const applyForMonth = (monthRef: MonthRef, type: 'logged-in' | 'disbursed') => {
    if (!filterOptions) return

    if (type === 'logged-in') {
      if (loggedInStageIds.length === 0) {
        setError('No Logged In stage is configured in the pipeline. Mark a stage as Logged In under Loan Status Pipeline.')

        return
      }

      setError(null)
      onApply(buildMonthlyStageReportFilters(loggedInStageIds, {}, monthRef))

      return
    }

    setError(null)
    onApply(buildMonthlyDisbursedReportFilters(filterOptions.stages, {}, monthRef))
  }

  const handleLoggedIn = () => {
    applyForMonth(navMonth, 'logged-in')
  }

  const handleDisbursed = () => {
    applyForMonth(navMonth, 'disbursed')
  }

  const shiftMonth = (delta: number) => {
    const nextMonth = shiftMonthRef(navMonth, delta)

    if (isFutureMonthRef(nextMonth)) return

    setNavMonth(nextMonth)

    if (!filterOptions) return

    const activeType = detectMonthlyReportType(filters, filterOptions.stages)

    if (activeType) {
      applyForMonth(nextMonth, activeType)
    }
  }

  const goToThisMonth = () => {
    const current = getCurrentMonthRef()

    setNavMonth(current)

    if (!filterOptions) return

    const activeType = detectMonthlyReportType(filters, filterOptions.stages)

    if (activeType) {
      applyForMonth(current, activeType)
    }
  }

  return (
    <Card
      variant='outlined'
      sx={{
        borderRadius: 2.5,
        borderColor: monthlyActive ? alpha(theme.palette.primary.main, 0.35) : 'divider',
        bgcolor: monthlyActive ? alpha(theme.palette.primary.main, 0.03) : 'background.paper'
      }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              gap: 2
            }}
          >
            <Box>
              <Typography variant='subtitle1' fontWeight={700}>
                Monthly shortcuts
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
                Logged-In and Disbursed reports for the selected month
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Button
                variant={loggedInActive ? 'contained' : 'outlined'}
                color='info'
                disabled={loading || disabled || !filterOptions}
                onClick={handleLoggedIn}
                startIcon={<i className='ri-login-circle-line' />}
                sx={{ textTransform: 'none', fontWeight: loggedInActive ? 700 : 500, flex: isMobile ? 1 : undefined }}
              >
                Logged-In
              </Button>
              <Button
                variant={disbursedActive ? 'contained' : 'outlined'}
                color='success'
                disabled={loading || disabled || !filterOptions}
                onClick={handleDisbursed}
                startIcon={<i className='ri-money-rupee-circle-line' />}
                sx={{ textTransform: 'none', fontWeight: disbursedActive ? 700 : 500, flex: isMobile ? 1 : undefined }}
              >
                Disbursed
              </Button>
            </Box>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: { xs: 'stretch', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              p: { xs: 1.5, sm: 2 },
              borderRadius: 2,
              bgcolor: 'action.hover',
              border: '1px solid',
              borderColor: 'divider'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: { xs: 1, sm: 1.5 }, minWidth: 0 }}>
              <IconButton
                size='small'
                aria-label='Previous month'
                onClick={() => shiftMonth(-1)}
                disabled={loading || disabled}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'background.paper' }
                }}
              >
                <i className='ri-arrow-left-s-line' />
              </IconButton>

              <Box sx={{ textAlign: 'center', minWidth: 0, px: { xs: 0.5, sm: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant='h6' fontWeight={800} sx={{ lineHeight: 1.2 }}>
                    {monthLabel}
                  </Typography>
                  {isThisMonth ? (
                    <Chip
                      size='small'
                      label='Current month'
                      color='primary'
                      variant='filled'
                      sx={{ height: 24, fontWeight: 700 }}
                    />
                  ) : null}
                </Box>
                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                  {rangeCaption}
                </Typography>
              </Box>

              <IconButton
                size='small'
                aria-label='Next month'
                onClick={() => shiftMonth(1)}
                disabled={loading || disabled || !canGoForward}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': { bgcolor: 'background.paper' }
                }}
              >
                <i className='ri-arrow-right-s-line' />
              </IconButton>
            </Box>

            {!isThisMonth ? (
              <Button
                size='small'
                variant='outlined'
                onClick={goToThisMonth}
                disabled={loading || disabled}
                startIcon={<i className='ri-calendar-check-line' />}
                sx={{ textTransform: 'none', alignSelf: { xs: 'stretch', sm: 'center' }, whiteSpace: 'nowrap' }}
              >
                Jump to this month
              </Button>
            ) : null}
          </Box>

          {monthlyActive ? (
            <Typography variant='caption' color='text.secondary'>
              Viewing {loggedInActive ? 'logged-in stage history' : 'disbursement activity'} for {monthLabel.toLowerCase()}.
              Use the arrows to browse other months.
            </Typography>
          ) : null}

          {error ? <Alert severity='warning'>{error}</Alert> : null}
        </Box>
      </CardContent>
    </Card>
  )
}
