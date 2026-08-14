'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'

import useSWR from 'swr'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'
import { useSession } from 'next-auth/react'

import { useTenantModuleAccess } from '@features/subscriptions/hooks/useTenantModuleAccess'

import { useReports } from '../hooks/useReports'
import type { ReportPreset } from '../reports.types'
import ReportsBuilder from './ReportsBuilder'
import ReportsChartSection from './ReportsChartSection'
import ReportsExportActions from './ReportsExportActions'
import ReportsMonthlyQuickActions from './ReportsMonthlyQuickActions'
import ReportsPresetCards from './ReportsPresetCards'
import ReportsSummarySection from './ReportsSummarySection'
import ReportsTableSection from './ReportsTableSection'

export default function ReportsView() {
  const { filters, updateFilter, data, filterOptions, loading, optionsLoading, error, runReport, applyPreset, applyFilters, clearFilters } =
    useReports()

  const { data: session } = useSession()
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data: sessionTenant } = useSWR('/api/session/tenant', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  })
  const canManageSubscription = isSuperAdmin || sessionTenant?.role === 'OWNER'

  const { loading: accessLoading, enabled: reportsEnabled, planName } = useTenantModuleAccess('reports')
  const locked = !accessLoading && !reportsEnabled

  const [activePresetId, setActivePresetId] = useState<string | null>(null)

  const handlePreset = (preset: ReportPreset) => {
    if (locked) return
    setActivePresetId(preset.id)
    applyPreset(preset)
  }

  const showResults = useMemo(() => Boolean(data && !loading && !locked), [data, loading, locked])
  const actionsDisabled = locked || loading || optionsLoading

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 }, pb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2
        }}
      >
        <Box>
          <Typography variant='h4' sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}>
            Reports
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5, maxWidth: 720 }}>
            Build dynamic reports across leads, stages, agents, customers, banks, and loan types.
          </Typography>
        </Box>
        {data && !locked ? (
          <Box sx={{ width: { xs: '100%', md: 'auto' }, flexShrink: 0 }}>
            <ReportsExportActions data={data} groupBySecondary={filters.groupBySecondary} disabled={locked} />
          </Box>
        ) : null}
      </Box>

      {accessLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
          <CircularProgress size={18} />
          <Typography variant='body2' color='text.secondary'>
            Checking subscription access…
          </Typography>
        </Box>
      ) : null}

      {locked ? (
        <Alert
          severity='info'
          icon={<i className='ri-vip-crown-line' style={{ fontSize: 22 }} />}
          action={
            canManageSubscription ? (
              <Button
                component={Link}
                href='/admin/subscription'
                color='inherit'
                size='small'
                variant='outlined'
                sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
              >
                View subscription
              </Button>
            ) : undefined
          }
          sx={{ alignItems: 'center' }}
        >
          <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>Reports not included in your plan</AlertTitle>
          Please upgrade your subscription to access various report and download options
          {planName ? (
            <Typography component='span' variant='body2' color='text.secondary' sx={{ display: 'block', mt: 0.75 }}>
              Current plan: {planName}
            </Typography>
          ) : null}
        </Alert>
      ) : null}

      <Box
        sx={{
          opacity: locked ? 0.55 : 1,
          pointerEvents: locked ? 'none' : 'auto',
          transition: theme => theme.transitions.create('opacity')
        }}
        aria-disabled={locked}
      >
        <ReportsMonthlyQuickActions
          filters={filters}
          filterOptions={filterOptions}
          loading={actionsDisabled}
          disabled={locked}
          onApply={next => {
            if (locked) return
            setActivePresetId(null)
            applyFilters(next)
          }}
        />

        <Box sx={{ mt: 4 }}>
          <ReportsPresetCards onSelect={handlePreset} activePresetId={activePresetId} disabled={locked} />
        </Box>

        <Box sx={{ mt: 4 }}>
          <ReportsBuilder
            filters={filters}
            filterOptions={filterOptions}
            loading={actionsDisabled}
            disabled={locked}
            onChange={updateFilter}
            onRun={() => {
              if (locked) return
              setActivePresetId(null)
              void runReport()
            }}
            onClear={() => {
              if (locked) return
              setActivePresetId(null)
              clearFilters()
            }}
          />
        </Box>
      </Box>

      {error && !locked ? <Alert severity='error'>{error}</Alert> : null}

      {loading && !locked ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {showResults && data ? (
        <Box id='report-output' sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <ReportsSummarySection summary={data.summary} />
          <ReportsChartSection data={data} />
          <ReportsTableSection data={data} groupBySecondary={filters.groupBySecondary} />
          <Typography variant='caption' color='text.secondary'>
            Generated at {new Date(data.generatedAt).toLocaleString()}
          </Typography>
        </Box>
      ) : null}
    </Box>
  )
}
