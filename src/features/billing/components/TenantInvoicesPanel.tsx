'use client'

import { useCallback, useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'

import type { BillingInvoice } from '@features/billing/billing.types'
import { formatPaiseInr } from '@features/billing/gst'

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TenantInvoicesPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const [invoices, setInvoices] = useState<BillingInvoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/tenant/invoices?limit=50', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to load invoices')
      setInvoices(Array.isArray(json.invoices) ? json.invoices : [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load invoices')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load, refreshKey])

  return (
    <Card>
      <CardContent className='flex flex-col gap-3'>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Box>
            <Typography variant='h6'>Invoices</Typography>
            <Typography variant='body2' color='text.secondary'>
              GST tax invoices emailed on successful payment. Download anytime.
            </Typography>
          </Box>
          <Button size='small' variant='outlined' onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </Box>

        {error ? <Alert severity='error'>{error}</Alert> : null}
        {loading ? <Typography variant='body2'>Loading invoices…</Typography> : null}

        {!loading && invoices.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>
            No invoices yet. Pay or renew to generate your first tax invoice.
          </Typography>
        ) : null}

        {invoices.length > 0 ? (
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Invoice</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align='right'>Amount</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map(inv => (
                <TableRow key={inv._id}>
                  <TableCell>
                    <Typography variant='body2' fontWeight={600}>
                      {inv.invoiceNumber}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {inv.provider}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDate(inv.issuedAt || inv.createdAt)}</TableCell>
                  <TableCell>
                    <Stack direction='row' spacing={0.5} flexWrap='wrap' useFlexGap>
                      <Chip
                        size='small'
                        label={inv.status}
                        color={inv.status === 'paid' ? 'success' : inv.status === 'open' ? 'warning' : 'default'}
                      />
                      {inv.emailStatus === 'sent' ? (
                        <Chip size='small' variant='outlined' label='Emailed' />
                      ) : inv.emailStatus === 'failed' ? (
                        <Chip size='small' variant='outlined' color='error' label='Email failed' />
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell align='right'>{formatPaiseInr(inv.totalPaise)}</TableCell>
                  <TableCell align='right'>
                    <Button
                      size='small'
                      href={`/api/tenant/invoices/${encodeURIComponent(inv._id)}/download`}
                      target='_blank'
                      rel='noopener noreferrer'
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  )
}
