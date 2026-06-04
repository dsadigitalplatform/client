'use client'

import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import FormControl from '@mui/material/FormControl'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import { alpha, useTheme, type Theme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import {
  isTimelineModeRecommended,
  type DatedAmount,
  type TimelineMode,
  type TimelineRange
} from '@features/dashboard/utils/timelineBuckets'

export type BreakdownChartType = 'bar' | 'donut' | 'horizontal'
export type BreakdownMetric = 'amount' | 'count'
export type BreakdownSortOrder = 'desc' | 'asc' | 'name' | 'pipeline'
export type TopLimit = 5 | 8 | 10 | 0

const toggleGroupSx = {
  flexShrink: 0,
  borderRadius: 2,
  p: 0.25,
  bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.04),
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: 'none',
  '& .MuiToggleButtonGroup-grouped': {
    border: 0,
    borderRadius: '6px !important',
    mx: 0.125,
    px: { xs: 1, sm: 1.35 },
    py: { xs: 0.55, sm: 0.7 },
    minHeight: { xs: 32, sm: 34 },
    minWidth: { xs: 34, sm: 'auto' },
    textTransform: 'none',
    fontWeight: 600,
    fontSize: { xs: '0.6875rem', sm: '0.8125rem' },
    lineHeight: 1.2,
    color: 'text.secondary',
    transition: 'background-color 150ms ease, color 150ms ease',
    '&:hover': {
      bgcolor: 'action.hover'
    }
  },
  '& .Mui-selected': {
    bgcolor: 'primary.main !important',
    color: 'primary.contrastText !important',
    boxShadow: '0 2px 8px rgb(var(--mui-palette-primary-mainChannel) / 0.35)',
    '&:hover': {
      bgcolor: 'primary.dark !important'
    }
  }
} as const

const selectSx = {
  flexShrink: 0,
  minWidth: { xs: 58, sm: 92 },
  '& .MuiOutlinedInput-root': {
    borderRadius: 2,
    minHeight: { xs: 32, sm: 34 },
    fontSize: { xs: '0.6875rem', sm: '0.8125rem' },
    fontWeight: 600,
    bgcolor: (theme: Theme) => alpha(theme.palette.text.primary, 0.04),
    transition: 'border-color 150ms ease, background-color 150ms ease',
    '& fieldset': { borderColor: 'divider' },
    '&:hover fieldset': { borderColor: 'text.disabled' },
    '&.Mui-focused fieldset': { borderColor: 'primary.main', borderWidth: 1 }
  },
  '& .MuiSelect-select': {
    py: { xs: 0.55, sm: 0.7 },
    pl: { xs: 1, sm: 1.25 },
    pr: { xs: 2.25, sm: 2.75 },
    display: 'flex',
    alignItems: 'center'
  },
  '& .MuiSelect-icon': {
    fontSize: '1.1rem',
    right: 4
  }
} as const

export function ChartToolbarTrack({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 0.75, sm: 1 },
        flexWrap: 'nowrap',
        width: '100%',
        maxWidth: '100%',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '&::-webkit-scrollbar': { display: 'none' }
      }}
    >
      {children}
    </Box>
  )
}

const TOP_OPTIONS: TopLimit[] = [5, 8, 10, 0]

function topLabel(limit: TopLimit, compact: boolean) {
  if (limit === 0) return compact ? 'All' : 'All'
  return compact ? `T${limit}` : `Top ${limit}`
}

function sortLabel(order: BreakdownSortOrder, compact: boolean) {
  if (compact) {
    if (order === 'desc') return '↓'
    if (order === 'asc') return '↑'
    if (order === 'pipeline') return '⇢'

    return 'A-Z'
  }

  if (order === 'desc') return 'High → low'
  if (order === 'asc') return 'Low → high'
  if (order === 'pipeline') return 'Pipeline order'

  return 'A → Z'
}

const RANGE_SHORT: Record<TimelineRange, string> = {
  '8W': '8w',
  '12W': '12w',
  '6M': '6mo',
  '12M': '12mo',
  ALL: 'All'
}

const RANGE_LONG: Record<TimelineRange, string> = {
  '8W': 'Last 8 weeks',
  '12W': 'Last 12 weeks',
  '6M': 'Last 6 months',
  '12M': 'Last 12 months',
  ALL: 'All time'
}

type BreakdownControlsProps = {
  chartType: BreakdownChartType
  onChartType: (v: BreakdownChartType) => void
  metric: BreakdownMetric
  onMetric: (v: BreakdownMetric) => void
  topLimit: TopLimit
  onTopLimit: (v: TopLimit) => void
  sortOrder: BreakdownSortOrder
  onSortOrder: (v: BreakdownSortOrder) => void
  /** When set, only these sort options appear in the dropdown */
  sortOptions?: BreakdownSortOrder[]
}

const DEFAULT_SORT_OPTIONS: BreakdownSortOrder[] = ['desc', 'asc', 'name']

export function BreakdownChartControls({
  chartType,
  onChartType,
  metric,
  onMetric,
  topLimit,
  onTopLimit,
  sortOrder,
  onSortOrder,
  sortOptions = DEFAULT_SORT_OPTIONS
}: BreakdownControlsProps) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <ChartToolbarTrack>
      <ToggleButtonGroup
        size='small'
        exclusive
        value={metric}
        onChange={(_, v) => v && onMetric(v)}
        aria-label='Metric'
        sx={toggleGroupSx}
      >
        <ToggleButton value='amount' aria-label='By amount'>
          {compact ? <i className='ri-money-rupee-circle-line' style={{ fontSize: '1rem' }} /> : 'Amount'}
        </ToggleButton>
        <ToggleButton value='count' aria-label='By cases'>
          {compact ? <i className='ri-briefcase-4-line' style={{ fontSize: '1rem' }} /> : 'Cases'}
        </ToggleButton>
      </ToggleButtonGroup>

      <FormControl size='small' sx={selectSx}>
        <Select
          value={topLimit}
          onChange={e => onTopLimit(Number(e.target.value) as TopLimit)}
          aria-label='Top items'
          renderValue={v => topLabel(v as TopLimit, compact)}
        >
          {TOP_OPTIONS.map(n => (
            <MenuItem key={n} value={n} dense>
              {topLabel(n, false)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size='small' sx={selectSx}>
        <Select
          value={sortOrder}
          onChange={e => onSortOrder(e.target.value as BreakdownSortOrder)}
          aria-label='Sort order'
          renderValue={v => sortLabel(v as BreakdownSortOrder, compact)}
        >
          {sortOptions.map(option => (
            <MenuItem key={option} value={option} dense>
              {sortLabel(option, false)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <ToggleButtonGroup
        size='small'
        exclusive
        value={chartType}
        onChange={(_, v) => v && onChartType(v)}
        aria-label='Chart type'
        sx={toggleGroupSx}
      >
        <ToggleButton value='bar' aria-label='Column chart'>
          <i className='ri-bar-chart-grouped-line' style={{ fontSize: '1.05rem' }} />
        </ToggleButton>
        <ToggleButton value='horizontal' aria-label='Horizontal bars'>
          <i className='ri-bar-chart-horizontal-line' style={{ fontSize: '1.05rem' }} />
        </ToggleButton>
        <ToggleButton value='donut' aria-label='Donut chart'>
          <i className='ri-donut-chart-line' style={{ fontSize: '1.05rem' }} />
        </ToggleButton>
      </ToggleButtonGroup>
    </ChartToolbarTrack>
  )
}

type TimelineControlsProps = {
  timelineMode: TimelineMode
  onTimelineMode: (mode: TimelineMode) => void
  timelineRange?: TimelineRange
  onTimelineRange?: (range: TimelineRange) => void
  suggestedMode: TimelineMode
  datedFiltered: DatedAmount[]
  /** When false, range is controlled globally on the dashboard (granularity only) */
  showRangeControl?: boolean
}

export function TimelineChartControls({
  timelineMode,
  onTimelineMode,
  timelineRange,
  onTimelineRange,
  suggestedMode,
  datedFiltered,
  showRangeControl = true
}: TimelineControlsProps) {
  const theme = useTheme()
  const compact = useMediaQuery(theme.breakpoints.down('sm'))

  return (
    <ChartToolbarTrack>
      <ToggleButtonGroup
        size='small'
        exclusive
        value={timelineMode}
        onChange={(_, v) => v && onTimelineMode(v)}
        aria-label='Timeline granularity'
        sx={toggleGroupSx}
      >
        {(['WEEK', 'MONTH', 'YEAR'] as const).map(mode => (
          <ToggleButton
            key={mode}
            value={mode}
            sx={{ gap: 0.5, minWidth: compact ? 40 : 56 }}
            aria-label={mode === 'WEEK' ? 'Weekly' : mode === 'MONTH' ? 'Monthly' : 'Yearly'}
          >
            {compact ? (mode === 'WEEK' ? 'W' : mode === 'MONTH' ? 'M' : 'Y') : mode === 'WEEK' ? 'Week' : mode === 'MONTH' ? 'Month' : 'Year'}
            {datedFiltered.length > 0 && mode === suggestedMode && isTimelineModeRecommended(datedFiltered, mode) ? (
              <Box
                component='span'
                sx={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  bgcolor: 'currentColor',
                  opacity: 0.85,
                  flexShrink: 0
                }}
              />
            ) : null}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {showRangeControl && timelineRange != null && onTimelineRange ? (
        <FormControl size='small' sx={{ ...selectSx, minWidth: { xs: 64, sm: 128 } }}>
          <Select
            value={timelineRange}
            onChange={e => onTimelineRange(e.target.value as TimelineRange)}
            aria-label='Timeline range'
            renderValue={v => (compact ? RANGE_SHORT[v as TimelineRange] : RANGE_LONG[v as TimelineRange])}
          >
            {(Object.keys(RANGE_LONG) as TimelineRange[]).map(key => (
              <MenuItem key={key} value={key} dense>
                {RANGE_LONG[key]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : null}
    </ChartToolbarTrack>
  )
}
