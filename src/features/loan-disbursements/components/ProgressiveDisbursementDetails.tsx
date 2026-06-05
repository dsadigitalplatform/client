'use client'

import { useCallback, useEffect, useState } from 'react'

import Link from 'next/link'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MuiLink from '@mui/material/Link'

import type {
  DisbursementAuditHistoryItem,
  DisbursementStatus,
  DisbursementTrackerDetails
} from '@features/loan-disbursements/loan-disbursements.types'
import {
  addLoanDisbursement,
  getDisbursementAuditHistory,
  getDisbursementTrackerById
} from '@features/loan-disbursements/services/loanDisbursementsService'

type Props = {
  trackerId: string
}

const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

function statusChip(status: DisbursementStatus) {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Fully disbursed', color: 'success' as const }
    case 'PARTIAL':
      return { label: 'Partially disbursed', color: 'warning' as const }
    default:
      return { label: 'Awaiting first disbursement', color: 'default' as const }
  }
}

function formatDateInput(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${y}-${m}-${day}`
}

function formatDisplayDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ProgressiveDisbursementDetails({ trackerId }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [tracker, setTracker] = useState<DisbursementTrackerDetails | null>(null)
  const [audit, setAudit] = useState<DisbursementAuditHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [disbursedDate, setDisbursedDate] = useState(formatDateInput(new Date()))

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const [detail, history] = await Promise.all([
        getDisbursementTrackerById(trackerId),
        getDisbursementAuditHistory(trackerId)
      ])

      setTracker(detail)
      setAudit(history)
    } catch (e: unknown) {
      setTracker(null)
      setAudit([])
      setError((e as Error)?.message || 'Failed to load tracker')
    } finally {
      setLoading(false)
    }
  }, [trackerId])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setAmount('')
    setReason('')
    setBankReference('')
    setDisbursedDate(formatDateInput(new Date()))
    setFormError(null)
  }

  const handleAddDisbursement = async () => {
    if (!tracker) return

    const parsedAmount = Number(String(amount).replace(/,/g, ''))

    if (!(parsedAmount > 0)) {
      setFormError('Enter a valid amount greater than zero')

      return
    }

    if (!reason.trim()) {
      setFormError('Reason is required')

      return
    }

    setSubmitting(true)
    setFormError(null)

    try {
      await addLoanDisbursement(trackerId, {
        amount: parsedAmount,
        reason: reason.trim(),
        bankReference: bankReference.trim() || null,
        disbursedDate: `${disbursedDate}T12:00:00.000Z`
      })

      setAddOpen(false)
      resetForm()
      await load()
    } catch (e: unknown) {
      setFormError((e as Error)?.message || 'Failed to record disbursement')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !tracker) {
    return (
      <Box sx={{ py: 4 }}>
        <Alert severity='error' sx={{ mb: 2 }}>
          {error || 'Tracker not found'}
        </Alert>
        <Button component={Link} href='/progressive-disbursements' variant='outlined'>
          Back to list
        </Button>
      </Box>
    )
  }

  const chip = statusChip(tracker.disbursementStatus)
  const canAdd = tracker.disbursementStatus !== 'COMPLETED'

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mx: { xs: -2, sm: 0 } }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Button component={Link} href='/progressive-disbursements' startIcon={<i className='ri-arrow-left-line' />} size='small' sx={{ mb: 1 }}>
            All trackers
          </Button>
          <Typography variant='h5'>{tracker.customerName}</Typography>
          <Typography variant='body2' color='text.secondary'>
            {tracker.loanTypeName}
            {tracker.bankName ? ` · ${tracker.bankName}` : ''} · {tracker.stageName}
          </Typography>
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip size='small' label={chip.label} color={chip.color} />
            <MuiLink component={Link} href={`/loan-cases/${tracker.leadId}`} variant='body2'>
              Open lead
            </MuiLink>
          </Box>
        </Box>
        {canAdd ? (
          <Button variant='contained' startIcon={<i className='ri-add-line' />} onClick={() => setAddOpen(true)} fullWidth={isMobile}>
            Record disbursement
          </Button>
        ) : (
          <Chip icon={<i className='ri-checkbox-circle-line' />} label='Disbursement complete' color='success' />
        )}
      </Box>

      <Card
        variant='outlined'
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${theme.palette.primary.main}14 0%, ${theme.palette.background.paper} 55%)`
        }}
      >
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Grid container spacing={3} alignItems='center'>
            <Grid size={{ xs: 12, md: 5 }}>
              <Typography variant='overline' color='text.secondary'>
                Disbursement progress
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                <Typography variant='h3'>{tracker.progressPercent}%</Typography>
                <Typography variant='body2' color='text.secondary'>
                  of {formatINR(tracker.approvedAmount)}
                </Typography>
              </Box>
              <LinearProgress
                variant='determinate'
                value={tracker.progressPercent}
                sx={{ mt: 2, height: 12, borderRadius: 6 }}
                color={tracker.disbursementStatus === 'COMPLETED' ? 'success' : 'primary'}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 7 }}>
              <Grid container spacing={2}>
                {[
                  { label: 'Approved', value: formatINR(tracker.approvedAmount) },
                  { label: 'Disbursed', value: formatINR(tracker.totalDisbursedAmount) },
                  { label: 'Remaining', value: formatINR(tracker.remainingAmount) }
                ].map(item => (
                  <Grid size={{ xs: 4 }} key={item.label}>
                    <Typography variant='caption' color='text.secondary'>
                      {item.label}
                    </Typography>
                    <Typography variant='h6'>{item.value}</Typography>
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card variant='outlined' sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant='h6' gutterBottom>
                Disbursement history
              </Typography>
              {tracker.disbursements.length === 0 ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <Typography variant='body2' color='text.secondary'>
                    No disbursements recorded yet. Add the first payout when funds are released.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {tracker.disbursements.map((d, index) => (
                    <Box key={d.id}>
                      <Box sx={{ display: 'flex', gap: 2, py: 2 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: 'success.light',
                            color: 'success.dark',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}
                        >
                          <i className='ri-bank-line' />
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant='subtitle1' fontWeight={600}>
                              {formatINR(d.amount)}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {formatDisplayDate(d.disbursedDate)}
                            </Typography>
                          </Box>
                          <Typography variant='body2' sx={{ mt: 0.5 }}>
                            {d.reason}
                          </Typography>
                          {d.bankReference ? (
                            <Typography variant='caption' color='text.secondary'>
                              Ref: {d.bankReference}
                            </Typography>
                          ) : null}
                          <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 0.5 }}>
                            By {d.createdByName} · {formatDisplayDate(d.createdAt)}
                          </Typography>
                        </Box>
                      </Box>
                      {index < tracker.disbursements.length - 1 ? <Divider /> : null}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card variant='outlined' sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant='h6' gutterBottom>
                Audit trail
              </Typography>
              {audit.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  No audit entries yet.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {audit.map(item => (
                    <Box key={item.id} sx={{ pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                      <Typography variant='subtitle2'>{item.actionLabel}</Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {item.actorName || item.actorEmail || 'System'} · {formatDisplayDate(item.createdAt)}
                      </Typography>
                      {item.changes.length > 0 ? (
                        <Box component='ul' sx={{ m: 0, pl: 2.5, mt: 0.5 }}>
                          {item.changes.map((c, i) => (
                            <Typography component='li' variant='body2' key={i} color='text.secondary'>
                              {c.label}: {c.value || (c.from && c.to ? `${c.from} → ${c.to}` : c.to || c.from || '—')}
                            </Typography>
                          ))}
                        </Box>
                      ) : null}
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>

          <Card variant='outlined' sx={{ borderRadius: 2, mt: 2 }}>
            <CardContent>
              <Typography variant='subtitle2' color='text.secondary' gutterBottom>
                Tracker metadata
              </Typography>
              <Typography variant='body2'>Created by {tracker.createdByName}</Typography>
              <Typography variant='caption' color='text.secondary' display='block'>
                {formatDisplayDate(tracker.createdAt)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={addOpen} onClose={() => !submitting && setAddOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Record disbursement</DialogTitle>
        <DialogContent dividers>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Remaining balance: <strong>{formatINR(tracker.remainingAmount)}</strong>
          </Typography>
          {formError ? (
            <Alert severity='error' sx={{ mb: 2 }}>
              {formError}
            </Alert>
          ) : null}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label='Amount (₹)'
              type='number'
              value={amount}
              onChange={e => setAmount(e.target.value)}
              inputProps={{ min: 0, step: 'any' }}
              fullWidth
              helperText={`Max ${formatINR(tracker.remainingAmount)}`}
            />
            <TextField
              label='Disbursement date'
              type='date'
              value={disbursedDate}
              onChange={e => setDisbursedDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField label='Reason' value={reason} onChange={e => setReason(e.target.value)} multiline minRows={2} fullWidth required />
            <TextField
              label='Bank reference (optional)'
              value={bankReference}
              onChange={e => setBankReference(e.target.value)}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant='contained' onClick={() => void handleAddDisbursement()} disabled={submitting}>
            {submitting ? 'Saving…' : 'Save disbursement'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
