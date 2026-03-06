'use client'

import { useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Snackbar from '@mui/material/Snackbar'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'

import { createFollowUpAppointment, getAppointmentById, updateAppointment } from '@features/appointments/services/appointments'
import type { AppointmentStatus, AppointmentFollowUpType } from '@features/appointments/appointments.types'

type Props = {
  open: boolean
  appointmentId: string | null
  initialTab?: 'details' | 'followup'
  onClose: () => void
  onUpdated: (appointmentId?: string | null) => void
}

function formatDateTime(v: string | null) {
  if (!v) return '-'
  const d = new Date(v)

  if (Number.isNaN(d.getTime())) return '-'

  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}

function normalizeStatusKey(s: string) {
  return s === 'SCHEDULED' ? 'PENDING' : s
}

function formatStatusLabel(status: string) {
  const s = normalizeStatusKey(status)

  if (s === 'COMPLETED') return 'Completed'
  if (s === 'RESCHEDULED') return 'Rescheduled'
  if (s === 'CANCELLED') return 'Cancelled'
  if (s === 'NO_SHOW') return 'No Show'

  return 'Pending'
}

export default function AppointmentDetailsDialog({ open, appointmentId, initialTab = 'details', onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [savingOutcome, setSavingOutcome] = useState(false)
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState({ open: false, msg: '', severity: 'success' as 'success' | 'error' })

  const [data, setData] = useState<any | null>(null)

  const [tab, setTab] = useState<'details' | 'followup'>(initialTab)

  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [outcomeComments, setOutcomeComments] = useState<string>('')

  const [followUpType, setFollowUpType] = useState<AppointmentFollowUpType>('CALL')
  const [followUpScheduledAtLocal, setFollowUpScheduledAtLocal] = useState<string>('')
  const [followUpOutcomeComments, setFollowUpOutcomeComments] = useState<string>('')

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open || !appointmentId) return
    let active = true

    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const d = await getAppointmentById(appointmentId)

        if (!active) return
        setData(d)
        setStatus((d?.status as AppointmentStatus) || 'PENDING')
        setOutcomeComments(typeof d?.outcomeComments === 'string' ? d.outcomeComments : '')
      } catch (e: any) {
        if (!active) return
        setData(null)
        setError(e?.message || 'Failed to load appointment')
      } finally {
        if (!active) return
        setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [open, appointmentId])

  const canRender = open && appointmentId
  const isFollowUpMode = tab === 'followup'

  const followUpScheduledAtValue = useMemo(() => {
    if (!followUpScheduledAtLocal) return null
    const d = dayjs(followUpScheduledAtLocal)

    return d.isValid() ? d : null
  }, [followUpScheduledAtLocal])

  const close = (opts?: { keepToast?: boolean }) => {
    setData(null)
    setError(null)
    setStatus('')
    setOutcomeComments('')
    setFollowUpScheduledAtLocal('')
    setFollowUpOutcomeComments('')
    setFollowUpType('CALL')
    if (!opts?.keepToast) setToast(v => ({ ...v, open: false }))
    onClose()
  }

  const saveOutcome = async () => {
    if (!appointmentId) return
    setSavingOutcome(true)
    setError(null)

    try {
      await updateAppointment(appointmentId, {
        status: (status || 'PENDING') as AppointmentStatus,
        outcomeComments: outcomeComments.length > 0 ? outcomeComments : null
      })
      onUpdated(appointmentId)

      setToast({ open: true, msg: 'Outcome saved successfully', severity: 'success' })
      close({ keepToast: true })
    } catch (e: any) {
      setError(e?.message || 'Failed to update outcome')
    } finally {
      setSavingOutcome(false)
    }
  }

  const addFollowUp = async () => {
    if (!appointmentId) return

    const dt = followUpScheduledAtLocal ? new Date(followUpScheduledAtLocal) : null

    if (!dt || Number.isNaN(dt.getTime())) {
      setError('Please enter a valid follow-up date & time')

      return
    }

    setSavingFollowUp(true)
    setError(null)

    try {
      await createFollowUpAppointment(appointmentId, {
        followUpType,
        scheduledAt: dt.toISOString(),
        durationMinutes: 30,
        outcomeComments: followUpOutcomeComments.length > 0 ? followUpOutcomeComments : null
      })
      onUpdated(appointmentId)
      setTab('details')
      setFollowUpScheduledAtLocal('')
      setFollowUpOutcomeComments('')
      const d = await getAppointmentById(appointmentId)

      setData(d)
    } catch (e: any) {
      setError(e?.message || 'Failed to create follow-up')
    } finally {
      setSavingFollowUp(false)
    }
  }

  const statusOptions: Array<{ value: AppointmentStatus; label: string; icon: string }> = [
    { value: 'PENDING', label: formatStatusLabel('PENDING'), icon: 'ri-time-line' },
    { value: 'COMPLETED', label: formatStatusLabel('COMPLETED'), icon: 'ri-checkbox-circle-line' },
    { value: 'RESCHEDULED', label: formatStatusLabel('RESCHEDULED'), icon: 'ri-refresh-line' },
    { value: 'CANCELLED', label: formatStatusLabel('CANCELLED'), icon: 'ri-close-circle-line' },
    { value: 'NO_SHOW', label: formatStatusLabel('NO_SHOW'), icon: 'ri-user-unfollow-line' }
  ]

  const followUpTypeOptions: Array<{ value: AppointmentFollowUpType; label: string; icon: string }> = [
    { value: 'CALL', label: 'Call', icon: 'ri-phone-line' },
    { value: 'WHATSAPP', label: 'WhatsApp', icon: 'ri-whatsapp-line' },
    { value: 'VISIT', label: 'Visit', icon: 'ri-map-pin-line' },
    { value: 'EMAIL', label: 'Email', icon: 'ri-mail-line' }
  ]

  return (
    <>
      <Dialog open={open} onClose={close} fullWidth maxWidth='md'>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  bgcolor: 'primary.50',
                  color: 'primary.main',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <i className={isFollowUpMode ? 'ri-add-circle-line' : 'ri-calendar-event-line'} />
              </Box>
              <Box>
                <Typography variant='h6'>{isFollowUpMode ? 'Add Follow-up' : 'Appointment Details'}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  {isFollowUpMode ? 'Schedule the next follow-up activity' : 'Review and update appointment outcome'}
                </Typography>
              </Box>
            </Box>
            <Tooltip title='Close'>
              <IconButton aria-label='close' size='small' onClick={() => close()}>
                <i className='ri-close-line' />
              </IconButton>
            </Tooltip>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: 2, pb: 1 }}>
          {error ? (
            <Alert severity='error' sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <Typography variant='body2' color='text.secondary'>
              Loading...
            </Typography>
          ) : !data ? (
            <Typography variant='body2' color='text.secondary'>
              No data
            </Typography>
          ) : tab === 'details' ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <Box>
                  <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                    Customer
                  </Typography>
                  <Typography variant='body2'>{data?.customer?.fullName || data?.customerName || '-'}</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {data?.customer?.mobile || data?.customer?.email || ''}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                    Lead
                  </Typography>
                  <Typography variant='body2'>{data?.leadTitle || '-'}</Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {data?.leadId || ''}
                  </Typography>
                </Box>
              </Box>

              <Divider />

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                <Box>
                  <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                    Appointment
                  </Typography>
                  <Typography variant='body2'>{formatDateTime(data?.scheduledAt)}</Typography>
                </Box>
              </Box>

              <Divider />

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <FormControl size='small' fullWidth>
                  <InputLabel id='appointment-status'>Outcome Status</InputLabel>
                  <Select
                    labelId='appointment-status'
                    label='Outcome Status'
                    value={status || 'PENDING'}
                    onChange={e => setStatus(e.target.value as AppointmentStatus)}
                    renderValue={value => {
                      const option = statusOptions.find(o => o.value === value)

                      if (!option) return value

                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className={option.icon} />
                          <span>{option.label}</span>
                        </Box>
                      )
                    }}
                  >
                    {statusOptions.map(o => (
                      <MenuItem key={o.value} value={o.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className={o.icon} />
                          <span>{o.label}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  size='small'
                  label='Outcome Comments'
                  value={outcomeComments}
                  onChange={e => setOutcomeComments(e.target.value)}
                  fullWidth
                />
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant='contained' onClick={saveOutcome} disabled={savingOutcome}>
                  {savingOutcome ? 'Saving...' : 'Save Outcome'}
                </Button>
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 0.95fr' }, gap: 2, mt: 0.75 }}>
                <FormControl size='small' fullWidth sx={{ minWidth: 0 }}>
                  <InputLabel id='follow-up-type'>Follow-up Type</InputLabel>
                  <Select
                    labelId='follow-up-type'
                    label='Follow-up Type'
                    value={followUpType}
                    onChange={e => setFollowUpType(e.target.value as AppointmentFollowUpType)}
                    renderValue={value => {
                      const option = followUpTypeOptions.find(o => o.value === value)

                      if (!option) return value

                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className={option.icon} />
                          <span>{option.label}</span>
                        </Box>
                      )
                    }}
                  >
                    {followUpTypeOptions.map(o => (
                      <MenuItem key={o.value} value={o.value}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className={o.icon} />
                          <span>{o.label}</span>
                        </Box>
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <LocalizationProvider dateAdapter={AdapterDayjs}>
                  <DateTimePicker
                    label='Date & Time'
                    value={followUpScheduledAtValue}
                    onChange={(v: Dayjs | null) => setFollowUpScheduledAtLocal(v && v.isValid() ? v.format('YYYY-MM-DDTHH:mm') : '')}
                    format='YYYY-MM-DD HH:mm'
                    minutesStep={30}
                    disablePast
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        sx: {
                          minWidth: 0
                        }
                      }
                    }}
                  />
                </LocalizationProvider>
              </Box>
              <TextField
                size='small'
                label='Outcome Description'
                value={followUpOutcomeComments}
                onChange={e => setFollowUpOutcomeComments(e.target.value)}
                fullWidth
                multiline
                minRows={3}
              />
            </Box>
          )}
        </DialogContent>
        {isFollowUpMode ? (
          <DialogActions sx={{ px: 3, pb: 2, pt: 1, justifyContent: 'flex-end' }}>
            <Button variant='contained' onClick={addFollowUp} disabled={savingFollowUp || !canRender}>
              {savingFollowUp ? 'Creating...' : 'Create Follow-up'}
            </Button>
          </DialogActions>
        ) : null}
      </Dialog>
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast(v => ({ ...v, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setToast(v => ({ ...v, open: false }))}
          severity={toast.severity}
          variant='filled'
          icon={<i className='ri-checkbox-circle-line' />}
          sx={{
            width: '100%',
            color: 'text.primary',
            backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.7)',
            backdropFilter: 'blur(12px)',
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'rgb(var(--mui-palette-success-mainChannel) / 0.4)',
            boxShadow: '0 12px 30px rgb(0 0 0 / 0.12)',
            '& .MuiAlert-icon': {
              color: 'var(--mui-palette-success-main)'
            }
          }}
        >
          {toast.msg}
        </Alert>
      </Snackbar>
    </>
  )
}
