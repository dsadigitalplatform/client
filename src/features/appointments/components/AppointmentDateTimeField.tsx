'use client'

import { useEffect, useId, useRef, useState } from 'react'

import dayjs, { type Dayjs } from 'dayjs'

import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Chip from '@mui/material/Chip'
import FormHelperText from '@mui/material/FormHelperText'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Typography from '@mui/material/Typography'
import type { SxProps, Theme } from '@mui/material/styles'

type PeriodId = 'morning' | 'afternoon' | 'evening' | 'night'

type Period = {
  id: PeriodId
  label: string
  start: number
  end: number
}

const PERIODS: Period[] = [
  { id: 'morning', label: 'Morning', start: 6 * 60, end: 12 * 60 },
  { id: 'afternoon', label: 'Afternoon', start: 12 * 60, end: 17 * 60 },
  { id: 'evening', label: 'Evening', start: 17 * 60, end: 24 * 60 },
  { id: 'night', label: 'Night', start: 0, end: 6 * 60 }
]

const DISPLAY_FORMAT = 'DD MMM YYYY, hh:mm A'

export type AppointmentDateTimeFieldProps = {
  label?: string
  value: Dayjs | null
  onChange: (value: Dayjs | null) => void
  disabled?: boolean
  error?: boolean
  helperText?: string
  disablePast?: boolean
  minutesStep?: number
  fullWidth?: boolean
  sx?: SxProps<Theme>
}

function slotsForPeriod(periodId: PeriodId, step: number) {
  const range = PERIODS.find(item => item.id === periodId) ?? PERIODS[0]
  const slots: number[] = []

  for (let minute = range.start; minute < range.end; minute += step) slots.push(minute)

  return slots
}

function periodIdForMinutes(minutes: number): PeriodId {
  const match = PERIODS.find(period => minutes >= period.start && minutes < period.end)

  return match?.id ?? 'morning'
}

function atDateTime(date: Dayjs, minutes: number) {
  return date.startOf('day').add(minutes, 'minute').second(0).millisecond(0)
}

function isUnavailable(date: Dayjs, minutes: number, disablePast: boolean) {
  if (!disablePast) return false

  return !atDateTime(date, minutes).isAfter(dayjs())
}

function dayHasSlot(date: Dayjs, step: number, disablePast: boolean) {
  if (disablePast && date.startOf('day').isBefore(dayjs().startOf('day'))) return false

  return PERIODS.some(period =>
    slotsForPeriod(period.id, step).some(minutes => !isUnavailable(date, minutes, disablePast))
  )
}

function nextOpenSlot(step: number) {
  const now = dayjs()
  const minutesNow = now.hour() * 60 + now.minute()
  let next = Math.floor(minutesNow / step) * step + step
  let day = now.startOf('day')

  if (next >= 24 * 60) {
    day = day.add(1, 'day')
    next = 0
  }

  return atDateTime(day, next)
}

function defaultPeriod(date: Dayjs | null, minutes: number | null, step: number, disablePast: boolean): PeriodId {
  if (minutes != null) return periodIdForMinutes(minutes)

  if (date && disablePast && date.isSame(dayjs(), 'day')) {
    const next = nextOpenSlot(step)

    if (next.isSame(date, 'day')) return periodIdForMinutes(next.hour() * 60 + next.minute())
  }

  return 'morning'
}

function formatMinutes(minutes: number) {
  return dayjs().startOf('day').add(minutes, 'minute').format('hh:mm A')
}

export default function AppointmentDateTimeField({
  label = 'Date & Time',
  value,
  onChange,
  disabled = false,
  error = false,
  helperText,
  disablePast = true,
  minutesStep = 30,
  fullWidth = true,
  sx
}: AppointmentDateTimeFieldProps) {
  const step = minutesStep > 0 ? minutesStep : 30
  const panelId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const timeSectionRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'date' | 'time'>('date')
  const [draftDate, setDraftDate] = useState<Dayjs | null>(null)
  const [draftMinutes, setDraftMinutes] = useState<number | null>(null)
  const [period, setPeriod] = useState<PeriodId>('morning')

  useEffect(() => {
    if (!open) return

    const id = window.setTimeout(() => {
      const target = tab === 'time' ? (timeSectionRef.current ?? panelRef.current) : panelRef.current

      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }, 50)

    return () => window.clearTimeout(id)
  }, [open, tab])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown, true)

    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  const upcoming = nextOpenSlot(step)
  const preview = draftDate && draftMinutes != null ? atDateTime(draftDate, draftMinutes) : null
  const slots = slotsForPeriod(period, step)
  const activePeriod = PERIODS.find(item => item.id === period) ?? PERIODS[0]
  const rangeLabel = `${formatMinutes(activePeriod.start)} – ${formatMinutes(activePeriod.end - step)}`

  const displayValue = value && value.isValid() ? value.format(DISPLAY_FORMAT) : ''

  const summary = preview
    ? preview.format(`ddd, ${DISPLAY_FORMAT}`)
    : draftDate
      ? `${draftDate.format('ddd, DD MMM YYYY')} · choose a time`
      : 'Choose a date'

  const nextLabel = upcoming.isSame(dayjs(), 'day')
    ? `Next available · Today, ${upcoming.format('hh:mm A')}`
    : `Next available · ${upcoming.format('ddd, hh:mm A')}`

  const quickDates = [
    { label: 'Today', date: dayjs().startOf('day') },
    { label: 'Tomorrow', date: dayjs().add(1, 'day').startOf('day') },
    { label: 'In 2 days', date: dayjs().add(2, 'day').startOf('day') },
    { label: 'Next week', date: dayjs().add(7, 'day').startOf('day') }
  ]

  const toggle = () => {
    if (disabled) return

    if (open) {
      setOpen(false)

      return
    }

    const base = value && value.isValid() ? value : null
    const day = base ? base.startOf('day') : null
    const mins = base ? base.hour() * 60 + base.minute() : null

    setDraftDate(day)
    setDraftMinutes(mins)
    setPeriod(defaultPeriod(day, mins, step, disablePast))
    setTab(day ? 'time' : 'date')
    setOpen(true)
  }

  const pickDate = (date: Dayjs | null) => {
    if (!date || !date.isValid()) return
    const day = date.startOf('day')

    if (!dayHasSlot(day, step, disablePast)) return

    const keepMinutes = draftMinutes != null && !isUnavailable(day, draftMinutes, disablePast) ? draftMinutes : null

    setDraftDate(day)
    setDraftMinutes(keepMinutes)
    setPeriod(defaultPeriod(day, keepMinutes, step, disablePast))

    if (keepMinutes != null) onChange(atDateTime(day, keepMinutes))
    setTab('time')
  }

  const pickTime = (minutes: number) => {
    if (!draftDate || isUnavailable(draftDate, minutes, disablePast)) return

    setDraftMinutes(minutes)
    onChange(atDateTime(draftDate, minutes))
    setOpen(false)
  }

  const applyNext = () => {
    const next = nextOpenSlot(step)

    setDraftDate(next.startOf('day'))
    setDraftMinutes(next.hour() * 60 + next.minute())
    setPeriod(periodIdForMinutes(next.hour() * 60 + next.minute()))
    onChange(next)
    setOpen(false)
  }

  const clear = () => {
    setDraftDate(null)
    setDraftMinutes(null)
    setPeriod('morning')
    setTab('date')
    onChange(null)
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box sx={sx}>
        <TextField
          label={label}
          value={displayValue}
          placeholder='Select date and time'
          size='small'
          fullWidth={fullWidth}
          error={error}
          disabled={disabled}
          onClick={toggle}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              toggle()
            }
          }}
          InputLabelProps={{ shrink: true }}
          inputProps={{
            readOnly: true,
            inputMode: 'none',
            'aria-expanded': open,
            'aria-haspopup': 'dialog',
            'aria-controls': open ? panelId : undefined
          }}
          InputProps={{
            endAdornment: (
              <InputAdornment position='end'>
                <IconButton
                  size='small'
                  edge='end'
                  aria-label={open ? 'Close date and time picker' : 'Open date and time picker'}
                  onClick={event => {
                    event.stopPropagation()
                    toggle()
                  }}
                  disabled={disabled}
                >
                  <i className={open ? 'ri-arrow-up-s-line' : 'ri-calendar-line'} />
                </IconButton>
              </InputAdornment>
            )
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              cursor: disabled ? 'default' : 'pointer',
              ...(open && !error
                ? {
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                      borderWidth: 2
                    }
                  }
                : {
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderWidth: 2
                    }
                  })
            },
            '& .MuiOutlinedInput-input': {
              cursor: disabled ? 'default' : 'pointer',
              caretColor: 'transparent'
            }
          }}
        />

        {open ? (
          <Paper
            ref={panelRef}
            id={panelId}
            role='dialog'
            aria-label='Choose appointment date and time'
            variant='outlined'
            sx={{ mt: 1, borderRadius: 2, overflow: 'hidden' }}
          >
            <Box sx={{ px: 1.5, pt: 1.25 }}>
              <Button
                type='button'
                size='small'
                variant='outlined'
                onClick={applyNext}
                fullWidth
                sx={{ fontWeight: 700 }}
              >
                <Box component='span' sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                  <i className='ri-time-line' />
                  {nextLabel}
                </Box>
              </Button>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1.25 }}>
              <ButtonBase
                onClick={() => setTab('date')}
                aria-pressed={tab === 'date'}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: tab === 'date' ? 'primary.main' : 'transparent',
                  color: tab === 'date' ? 'primary.contrastText' : draftDate ? 'primary.main' : 'text.secondary',
                  fontWeight: 700,
                  fontSize: '0.8125rem'
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.7rem',
                    bgcolor: tab === 'date' ? 'primary.contrastText' : draftDate ? 'primary.main' : 'action.selected',
                    color: tab === 'date' ? 'primary.main' : draftDate ? 'primary.contrastText' : 'text.secondary'
                  }}
                >
                  {draftDate && tab !== 'date' ? <i className='ri-check-line' /> : '1'}
                </Box>
                Date
              </ButtonBase>
              <Box sx={{ flex: 1, height: 2, borderRadius: 1, bgcolor: draftDate ? 'primary.main' : 'divider' }} />
              <ButtonBase
                disabled={!draftDate}
                onClick={() => {
                  if (draftDate) setTab('time')
                }}
                aria-pressed={tab === 'time'}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  px: 1,
                  py: 0.5,
                  borderRadius: 999,
                  bgcolor: tab === 'time' ? 'primary.main' : 'transparent',
                  color: tab === 'time' ? 'primary.contrastText' : preview ? 'primary.main' : 'text.secondary',
                  fontWeight: 700,
                  fontSize: '0.8125rem'
                }}
              >
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '0.7rem',
                    bgcolor: tab === 'time' ? 'primary.contrastText' : preview ? 'primary.main' : 'action.selected',
                    color: tab === 'time' ? 'primary.main' : preview ? 'primary.contrastText' : 'text.secondary'
                  }}
                >
                  {preview && tab !== 'time' ? <i className='ri-check-line' /> : '2'}
                </Box>
                Time
              </ButtonBase>
            </Box>

            <Box
              sx={{
                maxHeight: 'min(420px, calc(100dvh - 240px))',
                overflowY: 'auto',
                scrollbarWidth: 'thin'
              }}
            >
              {tab === 'date' ? (
                <Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, px: 1.5, pt: 1.25 }}>
                    {quickDates.map(item => {
                      const selected = Boolean(draftDate?.isSame(item.date, 'day'))
                      const unavailable = !dayHasSlot(item.date, step, disablePast)

                      return (
                        <Chip
                          key={item.label}
                          size='small'
                          label={item.label}
                          clickable={!unavailable}
                          disabled={unavailable}
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          onClick={() => pickDate(item.date)}
                          sx={{ fontWeight: 600 }}
                        />
                      )
                    })}
                  </Box>
                  <DateCalendar
                    value={draftDate}
                    onChange={pickDate}
                    disablePast={disablePast}
                    reduceAnimations
                    shouldDisableDate={day => disablePast && !dayHasSlot(day, step, true)}
                    sx={{
                      width: '100%',
                      maxWidth: 360,
                      mx: 'auto',
                      '& .MuiPickersCalendarHeader-root': { pl: 1.5, pr: 1, mt: 0.5 }
                    }}
                  />
                </Box>
              ) : (
                <Box ref={timeSectionRef} sx={{ pt: 1.25 }}>
                  {draftDate ? (
                    <>
                      <ToggleButtonGroup
                        exclusive
                        fullWidth
                        size='small'
                        value={period}
                        onChange={(_, next: PeriodId | null) => {
                          if (next) setPeriod(next)
                        }}
                        aria-label='Time of day'
                        sx={{
                          px: 1.5,
                          '& .MuiToggleButton-root': {
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            lineHeight: 1.2,
                            py: 0.75,
                            px: 0.5
                          },
                          '& .MuiToggleButton-root.Mui-selected': {
                            bgcolor: 'primary.main',
                            color: 'primary.contrastText',
                            '&:hover': { bgcolor: 'primary.dark' }
                          }
                        }}
                      >
                        {PERIODS.map(item => (
                          <ToggleButton key={item.id} value={item.id}>
                            {item.label}
                          </ToggleButton>
                        ))}
                      </ToggleButtonGroup>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ display: 'block', textAlign: 'center', mt: 0.75 }}
                      >
                        {draftDate && slots.every(minutes => isUnavailable(draftDate, minutes, disablePast))
                          ? 'No times left in this part of the day'
                          : rangeLabel}
                      </Typography>
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))',
                          gap: 0.75,
                          px: 1.5,
                          pt: 1,
                          pb: 1.5
                        }}
                      >
                        {slots.map(minutes => {
                          const unavailable = isUnavailable(draftDate, minutes, disablePast)
                          const selected = draftMinutes === minutes

                          return (
                            <ButtonBase
                              key={minutes}
                              disabled={unavailable}
                              aria-pressed={selected}
                              onClick={() => pickTime(minutes)}
                              sx={{
                                minHeight: 40,
                                borderRadius: 1.5,
                                border: '1px solid',
                                borderColor: selected ? 'primary.main' : 'divider',
                                bgcolor: selected ? 'primary.main' : 'transparent',
                                color: selected ? 'primary.contrastText' : 'text.primary',
                                fontWeight: selected ? 700 : 500,
                                fontSize: '0.8125rem',
                                opacity: unavailable ? 0.38 : 1,
                                ...(!unavailable && !selected
                                  ? { '&:hover': { bgcolor: 'action.hover', borderColor: 'primary.main' } }
                                  : {}),
                                ...(selected ? { '&:hover': { bgcolor: 'primary.dark' } } : {})
                              }}
                            >
                              {formatMinutes(minutes)}
                            </ButtonBase>
                          )
                        })}
                      </Box>
                    </>
                  ) : (
                    <Typography variant='body2' color='text.secondary' sx={{ px: 1.5, py: 2 }}>
                      Choose a date first.
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 1,
                px: 1.5,
                py: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
                bgcolor: 'action.hover'
              }}
            >
              <Typography variant='body2' sx={{ fontWeight: 700, flex: 1, minWidth: 0 }}>
                {summary}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                {value ? (
                  <Button type='button' size='small' color='inherit' onClick={clear}>
                    Clear
                  </Button>
                ) : null}
                {preview ? (
                  <Button type='button' size='small' variant='contained' onClick={() => setOpen(false)}>
                    Done
                  </Button>
                ) : null}
              </Box>
            </Box>
          </Paper>
        ) : null}

        {helperText ? (
          <FormHelperText error={error} sx={{ mx: 1.75 }}>
            {helperText}
          </FormHelperText>
        ) : null}
      </Box>
    </LocalizationProvider>
  )
}
