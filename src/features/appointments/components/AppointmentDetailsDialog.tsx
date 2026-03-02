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
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'

import { createFollowUpAppointment, getAppointmentById, updateAppointment } from '@features/appointments/services/appointments'
import { getTenantUsers } from '@features/appointments/services/tenantUsersService'
import type { AppointmentStatus, AppointmentFollowUpType } from '@features/appointments/appointments.types'

type Props = {
  open: boolean
  appointmentId: string | null
  initialTab?: 'details' | 'followup'
  onClose: () => void
  onUpdated: () => void
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

function normalizeStatusLabel(s: string) {
  return s === 'SCHEDULED' ? 'PENDING' : s
}

export default function AppointmentDetailsDialog({ open, appointmentId, initialTab = 'details', onClose, onUpdated }: Props) {
  const [loading, setLoading] = useState(false)
  const [savingOutcome, setSavingOutcome] = useState(false)
  const [savingFollowUp, setSavingFollowUp] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState<any | null>(null)

  const [tab, setTab] = useState<'details' | 'followup'>(initialTab)

  const [status, setStatus] = useState<AppointmentStatus | ''>('')
  const [outcomeComments, setOutcomeComments] = useState<string>('')

  const [followUpType, setFollowUpType] = useState<AppointmentFollowUpType>('CALL')
  const [followUpScheduledAtLocal, setFollowUpScheduledAtLocal] = useState<string>('')
  const [followUpDurationMinutes, setFollowUpDurationMinutes] = useState<number>(30)
  const [followUpAssignedTo, setFollowUpAssignedTo] = useState<string>('')

  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string | null }>>([])

  useEffect(() => {
    if (!open) return
    setTab(initialTab)
  }, [open, initialTab])

  useEffect(() => {
    if (!open) return
    let active = true

    void (async () => {
      try {
        const u = await getTenantUsers()

        if (!active) return
        setUsers(u)
      } catch {
        if (!active) return
        setUsers([])
      }
    })()

    return () => {
      active = false
    }
  }, [open])

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
        setFollowUpAssignedTo(typeof d?.assignedTo === 'string' ? d.assignedTo : '')
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

  type OutcomeHistoryItem = {
    key: string
    status: string
    outcomeComments: string | null
    changedAt: string | null
  }

  const history = useMemo<OutcomeHistoryItem[]>(() => {
    const arr = Array.isArray(data?.outcomeHistory) ? data.outcomeHistory : []

    return arr
      .slice()
      .reverse()
      .map((h: any, idx: number) => ({
        key: `${idx}-${String(h?.changedAt || '')}`,
        status: normalizeStatusLabel(String(h?.status || '')),
        outcomeComments: h?.outcomeComments ?? null,
        changedAt: h?.changedAt ? String(h.changedAt) : null
      }))
  }, [data])

  const canRender = open && appointmentId

  const close = () => {
    setData(null)
    setError(null)
    setStatus('')
    setOutcomeComments('')
    setFollowUpScheduledAtLocal('')
    setFollowUpDurationMinutes(30)
    setFollowUpType('CALL')
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
      onUpdated()

      const d = await getAppointmentById(appointmentId)

      setData(d)
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
        durationMinutes: followUpDurationMinutes,
        assignedTo: followUpAssignedTo || null
      })
      onUpdated()
      setTab('details')
      setFollowUpScheduledAtLocal('')
      setFollowUpDurationMinutes(30)
      const d = await getAppointmentById(appointmentId)

      setData(d)
    } catch (e: any) {
      setError(e?.message || 'Failed to create follow-up')
    } finally {
      setSavingFollowUp(false)
    }
  }

  const statusOptions: Array<{ value: AppointmentStatus; label: string }> = [
    { value: 'PENDING', label: 'PENDING' },
    { value: 'COMPLETED', label: 'COMPLETED' },
    { value: 'RESCHEDULED', label: 'RESCHEDULED' },
    { value: 'CANCELLED', label: 'CANCELLED' },
    { value: 'NO_SHOW', label: 'NO_SHOW' }
  ]

  return (
    <Dialog open={open} onClose={close} fullWidth maxWidth='md'>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}>
          <Typography variant='h6'>Appointment</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              size='small'
              variant={tab === 'details' ? 'contained' : 'outlined'}
              onClick={() => setTab('details')}
              disabled={!canRender}
            >
              Details
            </Button>
            <Button
              size='small'
              variant={tab === 'followup' ? 'contained' : 'outlined'}
              onClick={() => setTab('followup')}
              disabled={!canRender}
            >
              Add Follow-up
            </Button>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>
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

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Box>
                <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                  Appointment
                </Typography>
                <Typography variant='body2'>
                  {formatDateTime(data?.scheduledAt)} • {data?.durationMinutes || 30} min
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  {data?.followUpType || '-'}
                </Typography>
              </Box>
              <Box>
                <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                  Assigned Agent
                </Typography>
                <Typography variant='body2'>{data?.assignedAgentName || data?.assignedAgentEmail || '-'}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  {data?.assignedAgentEmail || ''}
                </Typography>
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
                >
                  {statusOptions.map(o => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
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

            <Divider />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                Previous Outcome History
              </Typography>
              {history.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No history yet
                </Typography>
              ) : (
                history.map(h => (
                  <Box
                    key={h.key}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      px: 1.5,
                      py: 1.25
                    }}
                  >
                    <Typography variant='body2' sx={{ fontWeight: 700 }}>
                      {h.status || '-'}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {formatDateTime(h.changedAt)}
                    </Typography>
                    {h.outcomeComments ? (
                      <Typography variant='body2' sx={{ mt: 0.5 }}>
                        {String(h.outcomeComments)}
                      </Typography>
                    ) : null}
                  </Box>
                ))
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <FormControl size='small' fullWidth>
                <InputLabel id='follow-up-type'>Follow-up Type</InputLabel>
                <Select
                  labelId='follow-up-type'
                  label='Follow-up Type'
                  value={followUpType}
                  onChange={e => setFollowUpType(e.target.value as AppointmentFollowUpType)}
                >
                  <MenuItem value='CALL'>CALL</MenuItem>
                  <MenuItem value='WHATSAPP'>WHATSAPP</MenuItem>
                  <MenuItem value='VISIT'>VISIT</MenuItem>
                  <MenuItem value='EMAIL'>EMAIL</MenuItem>
                </Select>
              </FormControl>

              <TextField
                size='small'
                label='Date & Time'
                type='datetime-local'
                value={followUpScheduledAtLocal}
                onChange={e => setFollowUpScheduledAtLocal(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField
                size='small'
                label='Duration (minutes)'
                type='number'
                value={followUpDurationMinutes}
                onChange={e => setFollowUpDurationMinutes(Number(e.target.value))}
                fullWidth
              />
              <FormControl size='small' fullWidth>
                <InputLabel id='follow-up-assigned-to'>Assigned Agent</InputLabel>
                <Select
                  labelId='follow-up-assigned-to'
                  label='Assigned Agent'
                  value={followUpAssignedTo}
                  onChange={e => setFollowUpAssignedTo(String(e.target.value))}
                >
                  <MenuItem value=''>Default</MenuItem>
                  {users.map(u => (
                    <MenuItem key={u.id} value={u.id}>
                      {u.name || u.email || u.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant='contained' onClick={addFollowUp} disabled={savingFollowUp}>
                {savingFollowUp ? 'Creating...' : 'Create Follow-up'}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
