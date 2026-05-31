'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import Accordion from '@mui/material/Accordion'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccordionSummary from '@mui/material/AccordionSummary'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { getDisbursementTrackerById } from '@features/loan-disbursements/services/loanDisbursementsService'
import type { DisbursementTrackerDetails } from '@features/loan-disbursements/loan-disbursements.types'
import type { LeadDisbursementTrackerSummary } from '@features/loan-cases/loan-cases.types'

type Props = {
  tracker: LeadDisbursementTrackerSummary | null
  enableProgressivePayment: boolean
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

function statusChip(status: LeadDisbursementTrackerSummary['disbursementStatus']) {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Completed', color: 'success' as const }
    case 'PARTIAL':
      return { label: 'Partial', color: 'warning' as const }
    default:
      return { label: 'Pending', color: 'default' as const }
  }
}

function formatDisplayDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function LeadDisbursementProgressPanel({
  tracker,
  enableProgressivePayment,
  expanded,
  onExpandedChange
}: Props) {
  const [details, setDetails] = useState<DisbursementTrackerDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded || !tracker?.id) return

    let active = true

    setLoading(true)
    setError(null)

    void getDisbursementTrackerById(tracker.id)
      .then(data => {
        if (!active) return
        setDetails(data)
      })
      .catch((e: unknown) => {
        if (!active) return
        setDetails(null)
        setError((e as Error)?.message || 'Failed to load disbursement details')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [expanded, tracker?.id])

  if (!enableProgressivePayment && !tracker) return null

  const summary = details ?? (tracker ? {
    progressPercent: tracker.progressPercent,
    approvedAmount: tracker.approvedAmount,
    totalDisbursedAmount: tracker.totalDisbursedAmount,
    remainingAmount: tracker.remainingAmount,
    disbursementStatus: tracker.disbursementStatus,
    disbursements: [] as DisbursementTrackerDetails['disbursements']
  } : null)

  const chip = tracker ? statusChip(tracker.disbursementStatus) : null

  return (
    <Accordion
      disableGutters
      expanded={expanded}
      onChange={(_, next) => onExpandedChange(next)}
      sx={{ borderRadius: 2.5, overflow: 'hidden' }}
    >
      <AccordionSummary expandIcon={<i className='ri-arrow-down-s-line' />}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, width: '100%', pr: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className='ri-funds-line' />
            <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
              Progressive disbursement
            </Typography>
          </Box>
          {tracker && chip ? (
            <Chip size='small' variant='outlined' color={chip.color} label={`${chip.label} · ${tracker.progressPercent}%`} />
          ) : (
            <Chip size='small' variant='outlined' label='Not started' />
          )}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        {!tracker ? (
          <Paper variant='outlined' sx={{ p: 2, borderRadius: 2.5, borderStyle: 'dashed' }}>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
              Progressive payment is enabled for this lead. Start tracking to record staged disbursements.
            </Typography>
            <Button component={Link} href='/progressive-disbursements' variant='contained' size='small' startIcon={<i className='ri-add-line' />}>
              Start tracking
            </Button>
          </Paper>
        ) : summary ? (
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, mb: 1 }}>
                <Typography variant='body2' color='text.secondary'>
                  {formatINR(summary.totalDisbursedAmount)} disbursed of {formatINR(summary.approvedAmount)}
                </Typography>
                <Typography variant='subtitle2' fontWeight={700}>
                  {summary.progressPercent}%
                </Typography>
              </Box>
              <LinearProgress
                variant='determinate'
                value={summary.progressPercent}
                sx={{ height: 10, borderRadius: 5 }}
                color={summary.disbursementStatus === 'COMPLETED' ? 'success' : 'primary'}
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
              <Paper variant='outlined' sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant='caption' color='text.secondary'>
                  Approved
                </Typography>
                <Typography variant='subtitle2' fontWeight={700}>
                  {formatINR(summary.approvedAmount)}
                </Typography>
              </Paper>
              <Paper variant='outlined' sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant='caption' color='text.secondary'>
                  Disbursed
                </Typography>
                <Typography variant='subtitle2' fontWeight={700} color='success.main'>
                  {formatINR(summary.totalDisbursedAmount)}
                </Typography>
              </Paper>
              <Paper variant='outlined' sx={{ p: 1.5, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant='caption' color='text.secondary'>
                  Remaining
                </Typography>
                <Typography variant='subtitle2' fontWeight={700}>
                  {formatINR(summary.remainingAmount)}
                </Typography>
              </Paper>
            </Box>

            {loading ? <LinearProgress /> : null}
            {error ? <Alert severity='error'>{error}</Alert> : null}

            {!loading && details && details.disbursements.length > 0 ? (
              <Stack spacing={1}>
                <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                  Recent disbursements
                </Typography>
                {details.disbursements.slice(0, 5).map(d => (
                  <Paper key={d.id} variant='outlined' sx={{ p: 1.5, borderRadius: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant='body2' fontWeight={600}>
                        {formatINR(d.amount)}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        {formatDisplayDate(d.disbursedDate)}
                      </Typography>
                    </Box>
                    <Typography variant='caption' color='text.secondary'>
                      {d.reason}
                    </Typography>
                  </Paper>
                ))}
              </Stack>
            ) : !loading && tracker.disbursementCount === 0 ? (
              <Typography variant='body2' color='text.secondary'>
                No disbursements recorded yet.
              </Typography>
            ) : null}

            <Button
              component={Link}
              href={`/progressive-disbursements/${tracker.id}`}
              variant='outlined'
              size='small'
              startIcon={<i className='ri-external-link-line' />}
            >
              Open full disbursement tracker
            </Button>
          </Stack>
        ) : null}
      </AccordionDetails>
    </Accordion>
  )
}
