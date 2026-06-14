'use client'

import { useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

import type { ReportFilterOptions, ReportFilters } from '../reports.types'
import {
  buildMonthlyStageReportFilters,
  findDisbursedStageId,
  findLoggedInStageId,
  getCurrentMonthDateRange,
  isMonthlyDisbursedFilters,
  isMonthlyLoggedInFilters
} from '../utils/monthlyReportHelpers'

type Props = {
  filters: ReportFilters
  filterOptions: ReportFilterOptions | null
  loading: boolean
  onApply: (filters: ReportFilters) => void
}

export default function ReportsMonthlyQuickActions({ filters, filterOptions, loading, onApply }: Props) {
  const [error, setError] = useState<string | null>(null)
  const { dateFrom, dateTo } = getCurrentMonthDateRange()

  const loggedInStageId = useMemo(
    () => (filterOptions ? findLoggedInStageId(filterOptions.stages) : null),
    [filterOptions]
  )

  const disbursedStageId = useMemo(
    () => (filterOptions ? findDisbursedStageId(filterOptions.stages) : null),
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

  const handleLoggedIn = () => {
    if (!loggedInStageId) {
      setError('No Logged In stage is configured in the pipeline. Mark a stage as Logged In under Loan Status Pipeline.')

      return
    }

    setError(null)
    onApply(buildMonthlyStageReportFilters(loggedInStageId))
  }

  const handleDisbursed = () => {
    if (!disbursedStageId) {
      setError('No Disbursed stage is configured in the pipeline. Mark a stage as Disbursed under Loan Status Pipeline.')

      return
    }

    setError(null)
    onApply(buildMonthlyStageReportFilters(disbursedStageId))
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
        <Button
          variant={loggedInActive ? 'contained' : 'outlined'}
          color='info'
          disabled={loading || !filterOptions}
          onClick={handleLoggedIn}
          startIcon={<i className='ri-login-circle-line' />}
          sx={{ textTransform: 'none', fontWeight: loggedInActive ? 700 : 500 }}
        >
          Monthly Logged-In
        </Button>
        <Button
          variant={disbursedActive ? 'contained' : 'outlined'}
          color='success'
          disabled={loading || !filterOptions}
          onClick={handleDisbursed}
          startIcon={<i className='ri-money-rupee-circle-line' />}
          sx={{ textTransform: 'none', fontWeight: disbursedActive ? 700 : 500 }}
        >
          Monthly Disbursed
        </Button>
        <Typography variant='caption' color='text.secondary'>
          Stage history · {dateFrom} to {dateTo}
        </Typography>
      </Box>
      {error ? <Alert severity='warning'>{error}</Alert> : null}
    </Box>
  )
}
