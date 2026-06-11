'use client'

import { useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Typography from '@mui/material/Typography'

import { useReports } from '../hooks/useReports'
import type { ReportPreset } from '../reports.types'
import ReportsBuilder from './ReportsBuilder'
import ReportsChartSection from './ReportsChartSection'
import ReportsDataModeBanner from './ReportsDataModeBanner'
import ReportsExportActions from './ReportsExportActions'
import ReportsPresetCards from './ReportsPresetCards'
import ReportsSummarySection from './ReportsSummarySection'
import ReportsTableSection from './ReportsTableSection'

export default function ReportsView() {
  const { filters, updateFilter, data, filterOptions, loading, optionsLoading, error, runReport, applyPreset, clearFilters } =
    useReports()

  const [activePresetId, setActivePresetId] = useState<string | null>('stage-wise-loans')

  const handlePreset = (preset: ReportPreset) => {
    setActivePresetId(preset.id)

    applyPreset(preset)
  }

  const showResults = useMemo(() => Boolean(data && !loading), [data, loading])

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
            Build dynamic reports across leads, stages, agents, customers, banks, and loan types. Switch between live
            snapshot and audit-based stage history with clear labelling.
          </Typography>
        </Box>
        {data ? <ReportsExportActions data={data} groupBySecondary={filters.groupBySecondary} /> : null}
      </Box>

      <ReportsPresetCards onSelect={handlePreset} activePresetId={activePresetId} />

      <ReportsBuilder
        filters={filters}
        filterOptions={filterOptions}
        loading={loading || optionsLoading}
        onChange={updateFilter}
        onRun={() => {
          setActivePresetId(null)
          void runReport()
        }}
        onClear={() => {
          setActivePresetId(null)
          clearFilters()
        }}
      />

      {error ? <Alert severity='error'>{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {showResults && data ? (
        <Box id='report-output' sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <ReportsDataModeBanner dataMode={data.dataMode} disclaimer={data.disclaimer} />
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
