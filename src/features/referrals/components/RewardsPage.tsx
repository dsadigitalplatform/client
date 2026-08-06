'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Checkbox from '@mui/material/Checkbox'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Link from 'next/link'

import { getMyRewards, requestReferralWithdrawal } from '../services/referralService'
import type {
  ReferralCredit,
  ReferralInvite,
  ReferralPayoutMethod,
  ReferralRewardsSummary,
  ReferralWithdrawal
} from '../referrals.types'

const formatINR = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const statusColor: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error' | 'primary'> = {
  invited: 'info',
  onboarded: 'warning',
  subscribed: 'primary',
  paid: 'success',
  cancelled: 'error',
  available: 'success',
  locked: 'warning',
  withdrawn: 'default',
  void: 'error',
  requested: 'warning',
  rejected: 'error'
}

function StatusChip({ status }: { status: string }) {
  return (
    <Chip
      size='small'
      label={status.charAt(0).toUpperCase() + status.slice(1)}
      color={statusColor[status] || 'default'}
      sx={{ fontWeight: 600, textTransform: 'capitalize' }}
    />
  )
}

export default function RewardsPage() {
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReferralRewardsSummary | null>(null)
  const [invites, setInvites] = useState<ReferralInvite[]>([])
  const [credits, setCredits] = useState<ReferralCredit[]>([])
  const [withdrawals, setWithdrawals] = useState<ReferralWithdrawal[]>([])
  const [tab, setTab] = useState(0)
  const [selected, setSelected] = useState<string[]>([])
  const [wdOpen, setWdOpen] = useState(false)
  const [method, setMethod] = useState<ReferralPayoutMethod>('upi')
  const [upiId, setUpiId] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [ifsc, setIfsc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const res = await getMyRewards()

      setSummary(res.summary)
      setInvites(res.invites)
      setCredits(res.credits)
      setWithdrawals(res.withdrawals)
    } catch {
      setError('Could not load rewards')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const availableCredits = useMemo(() => credits.filter(c => c.status === 'available'), [credits])

  const toggleCredit = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  const selectedAmount = availableCredits
    .filter(c => selected.includes(c.id))
    .reduce((s, c) => s + c.commissionAmount, 0)

  const submitWithdrawal = async () => {
    setError(null)
    setBusy(true)

    try {
      await requestReferralWithdrawal({
        creditIds: selected.length ? selected : availableCredits.map(c => c.id),
        payoutDetails:
          method === 'upi'
            ? { method: 'upi', upiId }
            : { method: 'bank', accountName, accountNumber, ifsc }
      })
      setWdOpen(false)
      setSelected([])
      await load()
    } catch (e: any) {
      setError(e?.message === 'invalid_payout' ? 'Enter valid payout details' : 'Withdrawal request failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant='h5' sx={{ fontWeight: 800, display: { xs: 'none', sm: 'block' } }}>
            Rewards
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Track referrals, credits, and withdrawals
          </Typography>
        </Box>
        <Button component={Link} href='/refer-and-earn' variant='outlined' startIcon={<i className='ri-gift-line' />}>
          Refer &amp; Earn
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
          gap: 1.5
        }}
      >
        {[
          { label: 'Available', value: formatINR(summary?.availableBalance || 0), accent: 'success.main' },
          { label: 'Pending payout', value: formatINR(summary?.pendingWithdrawal || 0), accent: 'warning.main' },
          { label: 'Lifetime earned', value: formatINR(summary?.lifetimeEarned || 0), accent: 'primary.main' },
          { label: 'Open invites', value: String(summary?.openInvites || 0), accent: 'info.main' }
        ].map(s => (
          <Card key={s.label} variant='outlined' sx={{ borderRadius: 3 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant='caption' color='text.secondary' fontWeight={700} textTransform='uppercase'>
                {s.label}
              </Typography>
              <Typography variant='h6' sx={{ fontWeight: 800, color: s.accent, mt: 0.5 }}>
                {s.value}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      {(summary?.availableBalance || 0) > 0 ? (
        <Button
          variant='contained'
          onClick={() => {
            setSelected(availableCredits.map(c => c.id))
            setWdOpen(true)
          }}
          sx={{ alignSelf: { xs: 'stretch', sm: 'flex-start' }, fontWeight: 700 }}
        >
          Request withdrawal
        </Button>
      ) : null}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant='scrollable' allowScrollButtonsMobile>
        <Tab label={`Referrals (${invites.length})`} />
        <Tab label={`Credits (${credits.length})`} />
        <Tab label={`Withdrawals (${withdrawals.length})`} />
      </Tabs>

      {tab === 0 && (
        <>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
            {invites.length === 0 ? (
              <Alert severity='info'>No referrals yet. Invite a DSA from Refer &amp; Earn.</Alert>
            ) : (
              invites.map(inv => (
                <Card key={inv.id} variant='outlined' sx={{ borderRadius: 2 }}>
                  <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                      <Typography fontWeight={700}>{inv.inviteeName || inv.inviteeEmail}</Typography>
                      <StatusChip status={inv.status} />
                    </Box>
                    <Typography variant='body2' color='text.secondary'>
                      {inv.inviteeEmail} · {inv.inviteeMobile}
                    </Typography>
                    {inv.referredTenantName ? (
                      <Typography variant='body2' sx={{ mt: 0.5 }}>
                        Org: {inv.referredTenantName}
                      </Typography>
                    ) : null}
                    <Typography variant='caption' color='text.secondary' display='block' sx={{ mt: 1 }}>
                      {inv.commissionCancelled
                        ? 'Commission cancelled'
                        : `${inv.effectiveCommissionPercent ?? '—'}% commission`}{' '}
                      · {new Date(inv.createdAt).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              ))
            )}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Invitee</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Organisation</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Commission</TableCell>
                  <TableCell>Invited</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invites.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.inviteeName || '—'}</TableCell>
                    <TableCell>
                      {inv.inviteeEmail}
                      <br />
                      <Typography variant='caption'>{inv.inviteeMobile}</Typography>
                    </TableCell>
                    <TableCell>{inv.referredTenantName || '—'}</TableCell>
                    <TableCell>
                      <StatusChip status={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.commissionCancelled ? 'Cancelled' : `${inv.effectiveCommissionPercent}%`}
                    </TableCell>
                    <TableCell>{new Date(inv.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}

      {tab === 1 && (
        <Box sx={{ overflowX: 'auto' }}>
          {credits.length === 0 ? (
            <Alert severity='info'>Credits appear after Super Admin records a paid subscription for your referral.</Alert>
          ) : (
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox' />
                  <TableCell>Organisation</TableCell>
                  <TableCell align='right'>Subscription</TableCell>
                  <TableCell align='right'>%</TableCell>
                  <TableCell align='right'>Credit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {credits.map(c => (
                  <TableRow key={c.id} hover>
                    <TableCell padding='checkbox'>
                      {c.status === 'available' ? (
                        <Checkbox checked={selected.includes(c.id)} onChange={() => toggleCredit(c.id)} />
                      ) : null}
                    </TableCell>
                    <TableCell>{c.referredTenantName || '—'}</TableCell>
                    <TableCell align='right'>{formatINR(c.subscriptionAmount)}</TableCell>
                    <TableCell align='right'>{c.commissionPercent}%</TableCell>
                    <TableCell align='right'>{formatINR(c.commissionAmount)}</TableCell>
                    <TableCell>
                      <StatusChip status={c.status} />
                    </TableCell>
                    <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {selected.length > 0 ? (
            <Button sx={{ mt: 2 }} variant='contained' onClick={() => setWdOpen(true)}>
              Withdraw selected ({formatINR(selectedAmount)})
            </Button>
          ) : null}
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {withdrawals.length === 0 ? (
            <Alert severity='info'>No withdrawal requests yet.</Alert>
          ) : (
            withdrawals.map(w => (
              <Card key={w.id} variant='outlined' sx={{ borderRadius: 2 }}>
                <CardContent sx={{ py: 2, display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                  <Box>
                    <Typography fontWeight={700}>{formatINR(w.amount)}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {w.payoutDetails.method === 'upi'
                        ? `UPI ${w.payoutDetails.upiId}`
                        : `Bank ${w.payoutDetails.accountNumber}`}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {new Date(w.requestedAt).toLocaleString()}
                    </Typography>
                  </Box>
                  <StatusChip status={w.status} />
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      )}

      <Dialog open={wdOpen} onClose={() => (!busy ? setWdOpen(false) : undefined)} fullWidth maxWidth='xs'>
        <DialogTitle>Request withdrawal</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            Amount: <strong>{formatINR(selected.length ? selectedAmount : summary?.availableBalance || 0)}</strong>.
            Super Admin will be emailed and settle the payout.
          </Typography>
          {error ? <Alert severity='error'>{error}</Alert> : null}
          <FormControl fullWidth>
            <InputLabel>Method</InputLabel>
            <Select
              label='Method'
              value={method}
              onChange={e => setMethod(e.target.value as ReferralPayoutMethod)}
            >
              <MenuItem value='upi'>UPI</MenuItem>
              <MenuItem value='bank'>Bank transfer</MenuItem>
            </Select>
          </FormControl>
          {method === 'upi' ? (
            <TextField label='UPI ID' value={upiId} onChange={e => setUpiId(e.target.value)} fullWidth required />
          ) : (
            <>
              <TextField label='Account name' value={accountName} onChange={e => setAccountName(e.target.value)} fullWidth />
              <TextField
                label='Account number'
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value)}
                fullWidth
              />
              <TextField label='IFSC' value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())} fullWidth />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWdOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant='contained' disabled={busy} onClick={() => void submitWithdrawal()}>
            Submit request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
