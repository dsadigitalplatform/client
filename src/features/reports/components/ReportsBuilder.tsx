'use client'

import { useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Collapse from '@mui/material/Collapse'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import type { ReportFilterOptions, ReportFilters } from '../reports.types'
import { DEFAULT_REPORT_FILTERS, filtersEqual, hasActiveDimensionFilters } from '../reports.types'

type Props = {
  filters: ReportFilters
  filterOptions: ReportFilterOptions | null
  loading: boolean
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

const VIEW_OPTIONS = [
  { value: 'full', label: 'Full report' },
  { value: 'summary', label: 'Summary only' },
  { value: 'detailed', label: 'Detailed table' },
  { value: 'trend', label: 'Trend only' }
] as const

export default function ReportsBuilder({ filters, filterOptions, loading, onChange, onRun, onClear }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [expanded, setExpanded] = useState(!isMobile)
  const canClear = !filtersEqual(filters, DEFAULT_REPORT_FILTERS)
  const hasDimensionFilters = hasActiveDimensionFilters(filters)

  return (
    <Card variant='outlined'>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant='h6'>Report builder</Typography>
            <Typography variant='body2' color='text.secondary'>
              Choose dimensions, filters, and output style
            </Typography>
          </Box>
          {isMobile ? (
            <Button size='small' onClick={() => setExpanded(v => !v)} endIcon={<i className={expanded ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'} />}>
              {expanded ? 'Hide filters' : 'Show filters'}
            </Button>
          ) : null}
        </Box>

        <Collapse in={expanded || !isMobile}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <ToggleButtonGroup
                exclusive
                fullWidth={isMobile}
                size='small'
                value={filters.dataMode}
                onChange={(_, v) => v && onChange('dataMode', v)}
              >
                <ToggleButton value='snapshot' sx={{ textTransform: 'none', flex: 1 }}>
                  <i className='ri-camera-line' style={{ marginRight: 6 }} />
                  Current snapshot
                </ToggleButton>
                <ToggleButton value='historical' sx={{ textTransform: 'none', flex: 1 }}>
                  <i className='ri-history-line' style={{ marginRight: 6 }} />
                  Stage history
                </ToggleButton>
              </ToggleButtonGroup>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Group by</InputLabel>
                <Select
                  label='Group by'
                  value={filters.groupBy}
                  onChange={e => onChange('groupBy', e.target.value as ReportFilters['groupBy'])}
                >
                  {GROUP_BY_OPTIONS.map(o => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                label={filters.dataMode === 'historical' ? 'Staged from' : 'Created from'}
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
                label={filters.dataMode === 'historical' ? 'Staged to' : 'Created to'}
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
              <FormControlLabel
                control={
                  <Switch checked={filters.showInactive} onChange={e => onChange('showInactive', e.target.checked)} />
                }
                label='Include inactive leads'
              />
            </Grid>
          </Grid>
        </Collapse>

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button variant='contained' onClick={onRun} disabled={loading} startIcon={<i className='ri-play-line' />}>
            {loading ? 'Running…' : 'Run report'}
          </Button>
          <Button
            variant='outlined'
            color='secondary'
            onClick={onClear}
            disabled={loading || !canClear}
            startIcon={<i className='ri-filter-off-line' />}
          >
            Clear filters
          </Button>
          {hasDimensionFilters ? (
            <Typography variant='caption' color='text.secondary'>
              Dimension filters active
            </Typography>
          ) : null}
        </Box>
      </CardContent>
    </Card>
  )
}
