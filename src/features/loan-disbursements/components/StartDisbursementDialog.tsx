'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
import InputAdornment from '@mui/material/InputAdornment'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import MuiLink from '@mui/material/Link'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import type { EligibleLeadItem } from '@features/loan-disbursements/loan-disbursements.types'
import { leadMatchesQuery, LeadIdentity } from '@features/loan-cases/components/LeadCodeDisplay'
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

const mobileCardSx = {
  borderRadius: 2.5,
  boxShadow: 'none',
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  cursor: 'pointer',
  transition: theme => theme.transitions.create(['border-color', 'background-color'], { duration: 150 })
} as const

function EligibleLeadMobileCard({
  lead,
  selected,
  onSelect
}: {
  lead: EligibleLeadItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <Card
      variant='outlined'
      onClick={onSelect}
      sx={{
        ...mobileCardSx,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? 'primary.50' : 'background.paper'
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box
            sx={{
              mt: 0.25,
              width: 20,
              height: 20,
              borderRadius: '50%',
              border: '2px solid',
              borderColor: selected ? 'primary.main' : 'action.disabled',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            aria-hidden
          >
            {selected ? <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'primary.main' }} /> : null}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <LeadIdentity
              customerName={lead.customerName}
              code={lead.leadCode}
              subtitle={`${lead.loanTypeName}${lead.bankName ? ` · ${lead.bankName}` : ''}`}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, mt: 1.5 }}>
              <Chip size='small' label={lead.stageName} color='success' variant='outlined' />
              <Typography variant='body2' fontWeight={600} color='primary.main'>
                {formatINR(lead.resolvedApprovedAmount)}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function StartDisbursementDialog({ open, onClose, onCreated }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
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

    return leads.filter(l =>
      leadMatchesQuery(q, {
        code: l.leadCode,
        customerName: l.customerName,
        loanTypeName: l.loanTypeName,
        bankName: l.bankName,
        stageName: l.stageName
      })
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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth='md' fullScreen={isMobile}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant='h6'>Start progressive disbursement</Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
          Select a lead with progressive payment enabled. Only one tracker per lead.
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', ...(isMobile && { px: 2 }) }}>
        <TextField
          fullWidth
          size='small'
          placeholder='Search code, customer, loan type, bank…'
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
        ) : isMobile ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1, minHeight: 0 }}>
            {filtered.map(lead => (
              <EligibleLeadMobileCard
                key={lead.id}
                lead={lead}
                selected={selectedLeadId === lead.id}
                onSelect={() => setSelectedLeadId(lead.id)}
              />
            ))}
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
                        <LeadIdentity
                          customerName={lead.customerName}
                          code={lead.leadCode}
                          subtitle={lead.bankName || undefined}
                        />
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
      <DialogActions
        sx={{
          px: 3,
          py: 2,
          flexDirection: isMobile ? 'column-reverse' : 'row',
          gap: isMobile ? 1 : 0,
          '& > :not(:first-of-type)': isMobile ? { ml: 0, width: '100%' } : undefined
        }}
      >
        <Button onClick={onClose} disabled={submitting} fullWidth={isMobile}>
          Cancel
        </Button>
        <Button
          variant='contained'
          onClick={() => void handleCreate()}
          disabled={!selectedLeadId || submitting}
          fullWidth={isMobile}
        >
          {submitting ? 'Creating…' : 'Start tracking'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
