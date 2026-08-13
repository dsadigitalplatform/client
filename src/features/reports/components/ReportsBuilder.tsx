'use client'

import { useState } from 'react'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'

import type { ReportDetailGroupDimension, ReportFilterOptions, ReportFilters } from '../reports.types'
import { DEFAULT_REPORT_FILTERS, filtersEqual, hasActiveDimensionFilters } from '../reports.types'
import { groupByLabel } from '../utils/exportReport'

type Props = {
  filters: ReportFilters
  filterOptions: ReportFilterOptions | null
  loading: boolean
  disabled?: boolean
  onChange: <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => void
  onRun: () => void
  onClear: () => void
}

const GROUP_BY_OPTIONS = [
  { value: 'stage', label: 'Stage' },
  { value: 'agent', label: 'Agent' },
  { value: 'customer', label: 'Customer' },
  { value: 'bank', label: 'Bank' },
  { value: 'loanType', label: 'Loan type' },
  { value: 'time', label: 'Time' }
] as const

const TABLE_GROUP_OPTIONS = GROUP_BY_OPTIONS.filter(option => option.value !== 'time')

function secondaryGroupOptions(primary: ReportFilters['groupBy']) {
  return TABLE_GROUP_OPTIONS.filter(option => option.value !== primary)
}

const VIEW_OPTIONS = [
  { value: 'full', label: 'Full report' },
  { value: 'summary', label: 'Summary only' },
  { value: 'detailed', label: 'Detailed table' },
  { value: 'trend', label: 'Trend only' }
] as const

const PROGRESSIVE_PAYMENT_FILTER_OPTIONS = [
  { value: '', label: 'All leads', hint: 'No progressive disbursement filter' },
  { value: 'ready_to_track', label: 'Ready to start', hint: 'Enabled on lead · tracker not created yet' },
  { value: 'tracking_active', label: 'Tracking active', hint: 'Enabled on lead · disbursement tracker exists' }
] as const

export default function ReportsBuilder({ filters, filterOptions, loading, disabled = false, onChange, onRun, onClear }: Props) {
  const [expanded, setExpanded] = useState(false)
  const canClear = !filtersEqual(filters, DEFAULT_REPORT_FILTERS)
  const hasDimensionFilters = hasActiveDimensionFilters(filters)
  const controlsDisabled = loading || disabled

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, next) => {
        if (disabled) return
        setExpanded(next)
      }}
      disableGutters
      variant='outlined'
      sx={{
        borderRadius: 1,
        '&:before': { display: 'none' },
        opacity: disabled ? 0.7 : 1
      }}
    >
      <AccordionSummary
        expandIcon={<i className='ri-arrow-down-s-line' />}
        sx={{
          px: { xs: 2, sm: 2.5 },
          '& .MuiAccordionSummary-content': {
            my: 1.5,
            alignItems: 'center',
            gap: 1.5,
            flexWrap: 'wrap'
          }
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant='h6'>Report builder</Typography>
          <Typography variant='body2' color='text.secondary'>
            Choose dimensions, filters, and output style
          </Typography>
        </Box>
        {hasDimensionFilters ? (
          <Chip size='small' color='primary' variant='outlined' label='Filters active' sx={{ mr: 1 }} />
        ) : null}
      </AccordionSummary>

      <AccordionDetails sx={{ px: { xs: 2, sm: 2.5 }, pb: { xs: 2, sm: 2.5 }, pt: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <Box
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  bgcolor: 'action.hover'
                }}
              >
                <Box>
                  <Typography variant='subtitle2'>Grouping</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Charts use the primary group. The detailed table can nest a second level with subtotals.
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormControl fullWidth size='small'>
                      <InputLabel>Primary group</InputLabel>
                      <Select
                        label='Primary group'
                        value={filters.groupBy}
                        onChange={e => {
                          const next = e.target.value as ReportFilters['groupBy']

                          onChange('groupBy', next)

                          if (filters.groupBySecondary === next) {
                            onChange('groupBySecondary', null)
                          }
                        }}
                      >
                        {GROUP_BY_OPTIONS.map(o => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormControl fullWidth size='small'>
                      <InputLabel>Secondary group (table)</InputLabel>
                      <Select
                        label='Secondary group (table)'
                        value={filters.groupBySecondary ?? ''}
                        onChange={e =>
                          onChange(
                            'groupBySecondary',
                            (e.target.value || null) as ReportDetailGroupDimension | null
                          )
                        }
                      >
                        <MenuItem value=''>None — single level only</MenuItem>
                        {secondaryGroupOptions(filters.groupBy).map(o => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', minHeight: 40 }}>
                      <Typography variant='body2' color='text.secondary'>
                        {filters.groupBySecondary
                          ? `Table: ${groupByLabel(filters.groupBy)} → ${groupByLabel(filters.groupBySecondary)}`
                          : `Table: ${groupByLabel(filters.groupBy)} only`}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>View</InputLabel>
                <Select label='View' value={filters.view} onChange={e => onChange('view', e.target.value as ReportFilters['view'])}>
                  {VIEW_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Metric</InputLabel>
                <Select label='Metric' value={filters.metric} onChange={e => onChange('metric', e.target.value as ReportFilters['metric'])}>
                  <MenuItem value='count'>Case count</MenuItem>
                  <MenuItem value='amount'>Loan amount</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Trend granularity</InputLabel>
                <Select
                  label='Trend granularity'
                  value={filters.trendGranularity}
                  onChange={e => onChange('trendGranularity', e.target.value as ReportFilters['trendGranularity'])}
                >
                  <MenuItem value='week'>Weekly</MenuItem>
                  <MenuItem value='month'>Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                type='date'
                label='Created from'
                InputLabelProps={{ shrink: true }}
                value={filters.dateFrom ?? ''}
                onChange={e => onChange('dateFrom', e.target.value || null)}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                size='small'
                type='date'
                label='Created to'
                InputLabelProps={{ shrink: true }}
                value={filters.dateTo ?? ''}
                onChange={e => onChange('dateTo', e.target.value || null)}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Stage</InputLabel>
                <Select label='Stage' value={filters.stageId ?? ''} onChange={e => onChange('stageId', e.target.value || null)}>
                  <MenuItem value=''>All stages</MenuItem>
                  {filterOptions?.stages.map(s => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Agent</InputLabel>
                <Select
                  label='Agent'
                  value={filters.assignedAgentId ?? ''}
                  onChange={e => onChange('assignedAgentId', e.target.value || null)}
                >
                  <MenuItem value=''>All agents</MenuItem>
                  {filterOptions?.agents.map(a => (
                    <MenuItem key={a.id} value={a.id}>
                      {a.name ?? a.email ?? a.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Customer</InputLabel>
                <Select label='Customer' value={filters.customerId ?? ''} onChange={e => onChange('customerId', e.target.value || null)}>
                  <MenuItem value=''>All customers</MenuItem>
                  {filterOptions?.customers.map(c => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Loan type</InputLabel>
                <Select label='Loan type' value={filters.loanTypeId ?? ''} onChange={e => onChange('loanTypeId', e.target.value || null)}>
                  <MenuItem value=''>All loan types</MenuItem>
                  {filterOptions?.loanTypes.map(l => (
                    <MenuItem key={l.id} value={l.id}>
                      {l.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Bank</InputLabel>
                <Select label='Bank' value={filters.bankName ?? ''} onChange={e => onChange('bankName', e.target.value || null)}>
                  <MenuItem value=''>All banks</MenuItem>
                  {filterOptions?.banks.map(b => (
                    <MenuItem key={b.name} value={b.name}>
                      {b.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Progressive payment</InputLabel>
                <Select
                  label='Progressive payment'
                  value={filters.progressivePaymentFilter ?? ''}
                  onChange={e =>
                    onChange(
                      'progressivePaymentFilter',
                      (e.target.value || null) as ReportFilters['progressivePaymentFilter']
                    )
                  }
                >
                  {PROGRESSIVE_PAYMENT_FILTER_OPTIONS.map(option => (
                    <MenuItem key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControlLabel
                control={
                  <Switch checked={filters.showInactive} onChange={e => onChange('showInactive', e.target.checked)} />
                }
                label='Include inactive leads'
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button variant='contained' onClick={onRun} disabled={controlsDisabled} startIcon={<i className='ri-play-line' />}>
              {loading ? 'Running…' : 'Run report'}
            </Button>
            <Button
              variant='outlined'
              color='secondary'
              onClick={onClear}
              disabled={controlsDisabled || !canClear}
              startIcon={<i className='ri-filter-off-line' />}
            >
              Clear filters
            </Button>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  )
}
