'use client'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'

import {
  clampDashboardMonths,
  DASHBOARD_PERIOD_DEFAULT_MONTHS,
  DASHBOARD_PERIOD_MONTH_MAX,
  DASHBOARD_PERIOD_MONTH_MIN,
  periodToPreset,
  presetToPeriod,
  type DashboardPeriodPreset,
  type DashboardTimePeriod
} from '@features/dashboard/utils/timelineBuckets'

const PRESETS: Array<{ id: DashboardPeriodPreset; short: string }> = [
  { id: '8W', short: '8w' },
  { id: '6M', short: '6mo' },
  { id: '12M', short: '1y' },
  { id: 'ALL', short: 'All' }
]

type Props = {
  period: DashboardTimePeriod
  onPeriodChange: (period: DashboardTimePeriod) => void
  disabled?: boolean
}

const heroChipSx = {
  height: 22,
  fontSize: '0.65rem',
  fontWeight: 700,
  borderRadius: 1.25,
  '& .MuiChip-label': { px: 0.75, color: 'inherit' },
  color: 'common.white',
  border: '1px solid rgb(255 255 255 / 0.28)',
  bgcolor: 'rgb(255 255 255 / 0.12)',
  '&:hover': { bgcolor: 'rgb(255 255 255 / 0.2)' },
  '&.Mui-disabled': { opacity: 0.45 }
} as const

const heroChipSelectedSx = {
  ...heroChipSx,
  bgcolor: 'rgb(255 255 255 / 0.95)',
  borderColor: 'transparent',
  color: 'primary.dark',
  '& .MuiChip-label': { color: 'primary.dark' },
  '&:hover': { bgcolor: 'common.white' }
} as const

const labelSx = { fontWeight: 700, fontSize: '0.65rem', color: 'rgb(255 255 255 / 0.85)' } as const

/** Compact period controls for the dashboard hero (row below agent picker) */
export default function DashboardHeroPeriodControls({ period, onPeriodChange, disabled }: Props) {
  const activePreset = periodToPreset(period)
  const sliderMonths = period.mode === 'months' ? period.months : DASHBOARD_PERIOD_DEFAULT_MONTHS
  const sliderLabel = period.mode === 'all' ? 'All' : `${sliderMonths}mo`

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        width: '100%',
        px: 1.25,
        py: 1,
        borderRadius: 2.5,
        bgcolor: 'transparent',
        color: 'common.white'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
        <Typography variant='caption' sx={labelSx}>
          Period
        </Typography>
        <Typography variant='caption' sx={{ ...labelSx, fontWeight: 800 }}>
          {sliderLabel}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.35 }}>
        {PRESETS.map(p => {
          const selected = activePreset === p.id

          return (
            <Chip
              key={p.id}
              size='small'
              label={p.short}
              disabled={disabled}
              onClick={() => onPeriodChange(presetToPeriod(p.id))}
              sx={{
                flex: 1,
                maxWidth: 56,
                ...(selected ? heroChipSelectedSx : heroChipSx)
              }}
            />
          )
        })}
      </Box>

      <Slider
        size='small'
        value={sliderMonths}
        min={DASHBOARD_PERIOD_MONTH_MIN}
        max={DASHBOARD_PERIOD_MONTH_MAX}
        step={1}
        disabled={disabled || period.mode === 'all'}
        valueLabelDisplay='auto'
        valueLabelFormat={v => `${v}mo`}
        aria-label='Dashboard period in months'
        onChange={(_, value) => {
          const months = clampDashboardMonths(Array.isArray(value) ? value[0] : value)

          onPeriodChange({ mode: 'months', months })
        }}
        sx={{
          py: 0.5,
          mt: 1.25,
          color: 'common.white',
          '& .MuiSlider-thumb': {
            width: 12,
            height: 12,
            bgcolor: 'common.white',
            boxShadow: '0 1px 6px rgb(0 0 0 / 0.25)'
          },
          '& .MuiSlider-track': { height: 3, border: 0, bgcolor: 'rgb(255 255 255 / 0.85)' },
          '& .MuiSlider-rail': { height: 3, opacity: 1, bgcolor: 'rgb(255 255 255 / 0.22)' },
          '& .MuiSlider-valueLabel': {
            bgcolor: 'rgb(255 255 255 / 0.95)',
            color: 'primary.dark',
            fontWeight: 700,
            fontSize: '0.6rem',
            py: 0.25,
            px: 0.5
          }
        }}
      />
    </Box>
  )
}
