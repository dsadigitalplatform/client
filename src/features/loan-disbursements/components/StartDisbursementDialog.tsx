'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import InputAdornment from '@mui/material/InputAdornment'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import MuiLink from '@mui/material/Link'

import type { EligibleLeadItem } from '@features/loan-disbursements/loan-disbursements.types'
import {
  createDisbursementTracker,
  getEligibleLeadsForDisbursement
} from '@features/loan-disbursements/services/loanDisbursementsService'

type Props = {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

const formatINR = (v: number | null) => (v == null ? '—' : `₹ ${new Intl.NumberFormat('en-IN').format(v)}`)

export default function StartDisbursementDialog({ open, onClose, onCreated }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [leads, setLeads] = useState<EligibleLeadItem[]>([])
  const [search, setSearch] = useState('')
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const rows = await getEligibleLeadsForDisbursement()

      setLeads(rows)
    } catch (e: unknown) {
      setLeads([])
      setError((e as Error)?.message || 'Failed to load eligible leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    setSelectedLeadId(null)
    setSearch('')
    void loadLeads()
  }, [open, loadLeads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return leads

    return leads.filter(
      l =>
        l.customerName.toLowerCase().includes(q) ||
        l.loanTypeName.toLowerCase().includes(q) ||
        (l.bankName || '').toLowerCase().includes(q) ||
        l.stageName.toLowerCase().includes(q)
    )
  }, [leads, search])

  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null

  const handleCreate = async () => {
    if (!selectedLeadId) return

    setSubmitting(true)
    setError(null)

    try {
      const res = await createDisbursementTracker({ leadId: selectedLeadId })

      onCreated()
      onClose()
      router.push(`/progressive-disbursements/${res.id}`)
    } catch (e: unknown) {
      const err = e as Error & { code?: string; trackerId?: string }

      if (err.code === 'tracker_exists' && err.trackerId) {
        onCreated()
        onClose()
        router.push(`/progressive-disbursements/${err.trackerId}`)

        return
      }

      setError(err.message || 'Failed to start tracking')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant='h6'>Start progressive disbursement</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
          Select a lead with progressive payment enabled. Only one tracker per lead.
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        <TextField
          fullWidth
          size='small'
          placeholder='Search customer, loan type, bank…'
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position='start'>
                <i className='ri-search-line' />
              </InputAdornment>
            )
          }}
        />

        {error ? (
          <Alert severity='error' sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : null}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant='body1' gutterBottom>
              No eligible leads right now
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
              Leads need progressive payment enabled and no existing tracker yet.
            </Typography>
            <Button component={Link} href='/loan-cases' variant='outlined' size='small'>
              Open Lead Manager
            </Button>
          </Box>
        ) : (
          <Box sx={{ overflowX: 'auto', mx: -1 }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox' />
                  <TableCell>Customer</TableCell>
                  <TableCell>Loan</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell align='right'>Approved amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map(lead => {
                  const selected = selectedLeadId === lead.id

                  return (
                    <TableRow
                      key={lead.id}
                      hover
                      selected={selected}
                      onClick={() => setSelectedLeadId(lead.id)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding='checkbox'>
                        <input type='radio' checked={selected} readOnly aria-label={`Select ${lead.customerName}`} />
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2' fontWeight={600}>
                          {lead.customerName}
                        </Typography>
                        {lead.bankName ? (
                          <Typography variant='caption' color='text.secondary'>
                            {lead.bankName}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell>{lead.loanTypeName}</TableCell>
                      <TableCell>
                        <Chip size='small' label={lead.stageName} color='success' variant='outlined' />
                      </TableCell>
                      <TableCell align='right'>{formatINR(lead.resolvedApprovedAmount)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {selectedLead ? (
          <Alert severity='info' sx={{ mt: 2 }}>
            Tracking will use approved amount {formatINR(selectedLead.resolvedApprovedAmount)}. View lead in{' '}
            <MuiLink component={Link} href={`/loan-cases/${selectedLead.id}`}>
              Lead Manager
            </MuiLink>
            .
          </Alert>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant='contained' onClick={() => void handleCreate()} disabled={!selectedLeadId || submitting}>
          {submitting ? 'Creating…' : 'Start tracking'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
