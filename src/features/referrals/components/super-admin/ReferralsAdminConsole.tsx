'use client'

import { useCallback, useEffect, useState } from 'react'

import { useSearchParams } from 'next/navigation'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Autocomplete from '@mui/material/Autocomplete'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'

import {
  adminListReferrals,
  adminLinkReferral,
  adminUpdateInvite,
  adminResolveWithdrawal,
  adminVoidCredit,
  searchReferralUsers
} from '../../services/referralService'
import type { ReferralCredit, ReferralInvite, ReferralWithdrawal } from '../../referrals.types'

const formatINR = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

type TenantOption = { id: string; name: string }
type UserOption = { id: string; name: string; email: string; role?: string }

export default function ReferralsAdminConsole() {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get('tab') === 'withdrawals' ? 2 : searchParams.get('tab') === 'credits' ? 1 : 0

  const [tab, setTab] = useState(initialTab)
  const [loading, setLoading] = useState(true)
  const [invites, setInvites] = useState<ReferralInvite[]>([])
  const [credits, setCredits] = useState<ReferralCredit[]>([])
  const [withdrawals, setWithdrawals] = useState<ReferralWithdrawal[]>([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [linkOpen, setLinkOpen] = useState(false)
  const [linkInvite, setLinkInvite] = useState<ReferralInvite | null>(null)
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [createdOrg, setCreatedOrg] = useState<TenantOption | null>(null)
  const [referrerOrg, setReferrerOrg] = useState<TenantOption | null>(null)
  const [referrerUsers, setReferrerUsers] = useState<UserOption[]>([])
  const [inviteeUsers, setInviteeUsers] = useState<UserOption[]>([])
  const [selectedReferrer, setSelectedReferrer] = useState<UserOption | null>(null)
  const [selectedInvitee, setSelectedInvitee] = useState<UserOption | null>(null)
  const [usersLoading, setUsersLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideInvite, setOverrideInvite] = useState<ReferralInvite | null>(null)
  const [overridePct, setOverridePct] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const tabKey = tab === 1 ? 'credits' : tab === 2 ? 'withdrawals' : 'invites'
      const res = await adminListReferrals({
        tab: tabKey,
        status: statusFilter,
        q: q || undefined
      })

      if (tab === 0) setInvites(res.invites)
      if (tab === 1) setCredits(res.credits)
      if (tab === 2) setWithdrawals(res.withdrawals)
    } catch {
      setError('Failed to load')
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, q])

  useEffect(() => {
    void load()
  }, [load])

  const loadOrgUsers = useCallback(async (tenantId: string) => {
    const res = await searchReferralUsers('', tenantId)

    return res.users
  }, [])

  useEffect(() => {
    if (!referrerOrg?.id) {
      setReferrerUsers([])

      return
    }

    let cancelled = false

    setUsersLoading(true)
    void loadOrgUsers(referrerOrg.id)
      .then(users => {
        if (!cancelled) setReferrerUsers(users)
      })
      .catch(() => {
        if (!cancelled) setReferrerUsers([])
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [referrerOrg?.id, loadOrgUsers])

  useEffect(() => {
    if (!createdOrg?.id) {
      setInviteeUsers([])

      return
    }

    let cancelled = false

    void loadOrgUsers(createdOrg.id)
      .then(users => {
        if (!cancelled) setInviteeUsers(users)
      })
      .catch(() => {
        if (!cancelled) setInviteeUsers([])
      })

    return () => {
      cancelled = true
    }
  }, [createdOrg?.id, loadOrgUsers])

  const openLink = async (invite?: ReferralInvite | null) => {
    setLinkInvite(invite || null)
    setCreatedOrg(
      invite?.referredTenantId
        ? { id: invite.referredTenantId, name: invite.referredTenantName || 'Organisation' }
        : null
    )
    setReferrerOrg(null)
    setSelectedReferrer(
      invite
        ? { id: invite.referrerUserId, name: invite.referrerName || '', email: invite.referrerEmail || '' }
        : null
    )
    setSelectedInvitee(null)
    setReferrerUsers([])
    setInviteeUsers([])
    setLinkOpen(true)

    try {
      const res = await fetch('/api/super-admin/tenants?lite=1')
      const data = await res.json()
      const list = Array.isArray(data?.tenants) ? data.tenants : []

      setTenants(
        list.map((t: any) => ({
          id: String(t._id || t.id),
          name: String(t.name || 'Organisation')
        }))
      )
    } catch {
      setTenants([])
    }
  }

  const submitLink = async () => {
    if (!createdOrg || !selectedReferrer) return
    setBusy(true)
    setError(null)

    try {
      await adminLinkReferral({
        referredTenantId: createdOrg.id,
        referrerUserId: selectedReferrer.id,
        referralInviteId: linkInvite?.id || null,
        inviteeEmail: selectedInvitee?.email || linkInvite?.inviteeEmail || null,
        inviteeMobile: linkInvite?.inviteeMobile || null,
        inviteeName: selectedInvitee?.name || linkInvite?.inviteeName || null
      })
      setLinkOpen(false)
      await load()
    } catch (e: any) {
      setError(e?.message === 'tenant_already_attributed' ? 'This organisation is already linked' : 'Link failed')
    } finally {
      setBusy(false)
    }
  }

  const saveOverride = async (cancelled?: boolean) => {
    if (!overrideInvite) return
    setBusy(true)

    try {
      await adminUpdateInvite(overrideInvite.id, {
        commissionCancelled: cancelled === true ? true : cancelled === false ? false : undefined,
        commissionPercentOverride:
          cancelled === true
            ? undefined
            : overridePct === ''
              ? null
              : Number(overridePct)
      })
      setOverrideOpen(false)
      await load()
    } catch {
      setError('Update failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant='outlined' size='small' onClick={() => void openLink(null)} startIcon={<i className='ri-link' />}>
          Link org to referrer
        </Button>
        {tab === 0 ? (
          <>
            <FormControl size='small' sx={{ minWidth: 140 }}>
              <InputLabel>Status</InputLabel>
              <Select label='Status' value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <MenuItem value='all'>All</MenuItem>
                <MenuItem value='invited'>Invited</MenuItem>
                <MenuItem value='onboarded'>Onboarded</MenuItem>
                <MenuItem value='subscribed'>Subscribed</MenuItem>
                <MenuItem value='paid'>Paid</MenuItem>
                <MenuItem value='cancelled'>Cancelled</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size='small'
              placeholder='Search email / mobile'
              value={q}
              onChange={e => setQ(e.target.value)}
              sx={{ minWidth: 200 }}
            />
          </>
        ) : null}
      </Box>

      {error ? <Alert severity='error'>{error}</Alert> : null}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant='scrollable' allowScrollButtonsMobile>
        <Tab label='Invites' />
        <Tab label='Credits' />
        <Tab label='Withdrawals' />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : null}

      {!loading && tab === 0 && (
        <>
          <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', gap: 1.5 }}>
            {invites.map(inv => (
              <Card key={inv.id} variant='outlined'>
                <CardContent sx={{ py: 2 }}>
                  <Typography fontWeight={700}>{inv.inviteeName || inv.inviteeEmail}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {inv.inviteeEmail} · {inv.inviteeMobile}
                  </Typography>
                  <Typography variant='body2' sx={{ mt: 0.5 }}>
                    By {inv.referrerName || inv.referrerEmail} → {inv.referredTenantName || 'unlinked'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                    <Chip size='small' label={inv.status} />
                    <Button size='small' onClick={() => void openLink(inv)}>
                      Link
                    </Button>
                    <Button
                      size='small'
                      onClick={() => {
                        setOverrideInvite(inv)
                        setOverridePct(
                          inv.commissionPercentOverride != null ? String(inv.commissionPercentOverride) : ''
                        )
                        setOverrideOpen(true)
                      }}
                    >
                      Commission
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Invitee</TableCell>
                  <TableCell>Referrer</TableCell>
                  <TableCell>Organisation</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>%</TableCell>
                  <TableCell align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invites.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      {inv.inviteeName || '—'}
                      <Typography variant='caption' display='block'>
                        {inv.inviteeEmail} / {inv.inviteeMobile}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {inv.referrerName}
                      <Typography variant='caption' display='block'>
                        {inv.referrerEmail}
                      </Typography>
                    </TableCell>
                    <TableCell>{inv.referredTenantName || '—'}</TableCell>
                    <TableCell>
                      <Chip size='small' label={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.commissionCancelled ? 'Cancelled' : `${inv.effectiveCommissionPercent}%`}
                    </TableCell>
                    <TableCell align='right'>
                      <Button size='small' onClick={() => void openLink(inv)}>
                        Link
                      </Button>
                      <Button
                        size='small'
                        onClick={() => {
                          setOverrideInvite(inv)
                          setOverridePct(
                            inv.commissionPercentOverride != null ? String(inv.commissionPercentOverride) : ''
                          )
                          setOverrideOpen(true)
                        }}
                      >
                        Edit %
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </>
      )}

      {!loading && tab === 1 && (
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell>Organisation</TableCell>
              <TableCell align='right'>Subscription</TableCell>
              <TableCell align='right'>Credit</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date</TableCell>
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {credits.map(c => (
              <TableRow key={c.id}>
                <TableCell>{c.referredTenantName || c.referredTenantId}</TableCell>
                <TableCell align='right'>{formatINR(c.subscriptionAmount)}</TableCell>
                <TableCell align='right'>
                  {formatINR(c.commissionAmount)} ({c.commissionPercent}%)
                </TableCell>
                <TableCell>
                  <Chip size='small' label={c.status} />
                </TableCell>
                <TableCell>{new Date(c.createdAt).toLocaleDateString()}</TableCell>
                <TableCell align='right'>
                  {c.status === 'available' ? (
                    <Button
                      size='small'
                      color='error'
                      onClick={() =>
                        void adminVoidCredit(c.id)
                          .then(() => load())
                          .catch(() => setError('Void failed'))
                      }
                    >
                      Void
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {!loading && tab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {withdrawals.map(w => (
            <Card key={w.id} variant='outlined'>
              <CardContent
                sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}
              >
                <Box>
                  <Typography fontWeight={700}>
                    {formatINR(w.amount)} — {w.referrerName || w.referrerEmail}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {w.payoutDetails.method === 'upi'
                      ? `UPI ${w.payoutDetails.upiId}`
                      : `${w.payoutDetails.accountName} / ${w.payoutDetails.accountNumber} / ${w.payoutDetails.ifsc}`}
                  </Typography>
                  <Typography variant='caption'>{new Date(w.requestedAt).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <Chip size='small' label={w.status} color={w.status === 'paid' ? 'success' : w.status === 'rejected' ? 'error' : 'warning'} />
                  {w.status === 'requested' ? (
                    <>
                      <Button
                        size='small'
                        variant='contained'
                        onClick={() =>
                          void adminResolveWithdrawal(w.id, { action: 'paid' })
                            .then(() => load())
                            .catch(() => setError('Failed'))
                        }
                      >
                        Mark paid
                      </Button>
                      <Button
                        size='small'
                        color='error'
                        onClick={() =>
                          void adminResolveWithdrawal(w.id, { action: 'rejected' })
                            .then(() => load())
                            .catch(() => setError('Failed'))
                        }
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={linkOpen} onClose={() => (!busy ? setLinkOpen(false) : undefined)} fullWidth maxWidth='sm'>
        <DialogTitle>{linkInvite ? 'Link invite to organisation' : 'Link organisation to referrer'}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            Works with or without a prior invite. Pick the created organisation, then choose the referrer from their
            organisation&apos;s members. Future paid subscriptions will credit that referrer.
          </Typography>

          <Autocomplete
            options={tenants}
            getOptionLabel={o => o.name}
            value={createdOrg}
            onChange={(_, v) => {
              setCreatedOrg(v)
              setSelectedInvitee(null)
            }}
            renderInput={params => (
              <TextField {...params} label='Created organisation' helperText='The DSA org that was onboarded' />
            )}
          />

          <Autocomplete
            options={inviteeUsers}
            getOptionLabel={o => `${o.name || 'User'}${o.email ? ` (${o.email})` : ''}${o.role ? ` · ${o.role}` : ''}`}
            value={selectedInvitee}
            onChange={(_, v) => setSelectedInvitee(v)}
            disabled={!createdOrg}
            noOptionsText={createdOrg ? 'No users in this organisation' : 'Select created organisation first'}
            renderInput={params => (
              <TextField
                {...params}
                label='Invitee / org contact (optional)'
                helperText={
                  linkInvite
                    ? `Invite: ${linkInvite.inviteeEmail} / ${linkInvite.inviteeMobile}`
                    : 'Users listed from the created organisation'
                }
              />
            )}
          />

          <Autocomplete
            options={tenants}
            getOptionLabel={o => o.name}
            value={referrerOrg}
            onChange={(_, v) => {
              setReferrerOrg(v)
              setSelectedReferrer(null)
            }}
            renderInput={params => (
              <TextField
                {...params}
                label="Referrer's organisation"
                helperText='Organisation of the team member who referred'
              />
            )}
          />

          <Autocomplete
            options={
              selectedReferrer && !referrerUsers.some(u => u.id === selectedReferrer.id)
                ? [selectedReferrer, ...referrerUsers]
                : referrerUsers
            }
            getOptionLabel={o => `${o.name || 'User'}${o.email ? ` (${o.email})` : ''}${o.role ? ` · ${o.role}` : ''}`}
            value={selectedReferrer}
            onChange={(_, v) => setSelectedReferrer(v)}
            disabled={!referrerOrg}
            loading={usersLoading}
            noOptionsText={
              usersLoading
                ? 'Loading users…'
                : referrerOrg
                  ? 'No users in this organisation'
                  : "Select referrer's organisation first"
            }
            renderInput={params => (
              <TextField
                {...params}
                label='Referrer user'
                helperText='Members of the selected referrer organisation'
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant='contained'
            disabled={busy || !createdOrg || !selectedReferrer}
            onClick={() => void submitLink()}
          >
            Link
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={overrideOpen} onClose={() => (!busy ? setOverrideOpen(false) : undefined)} fullWidth maxWidth='xs'>
        <DialogTitle>Commission override</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Typography variant='body2' color='text.secondary'>
            Leave blank to use the program default. Cancel stops future credits for this referral.
          </Typography>
          <TextField
            label='Override %'
            type='number'
            value={overridePct}
            onChange={e => setOverridePct(e.target.value)}
            inputProps={{ min: 0, max: 100, step: 0.5 }}
            helperText='Empty = program default'
          />
        </DialogContent>
        <DialogActions sx={{ flexWrap: 'wrap' }}>
          <Button color='error' disabled={busy} onClick={() => void saveOverride(true)}>
            Cancel commission
          </Button>
          <Button disabled={busy} onClick={() => void saveOverride(false)}>
            Restore
          </Button>
          <Button variant='contained' disabled={busy} onClick={() => void saveOverride()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
