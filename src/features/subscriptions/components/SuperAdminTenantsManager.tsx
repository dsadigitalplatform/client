'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import { formatPlanMoney } from '@features/subscription-plans/currencies'
import type { ManualPaymentMethod, SubscriptionPricing } from '@features/subscriptions/subscriptions.types'
import { PayAmountDisplay } from '@features/subscriptions/components/PayAmountDisplay'

type TenantRow = {
  _id: string
  name: string
  type: string | null
  status: string
  subscriptionPlan: { _id: string; name: string } | null
  subscription: {
    status: string
    currentPeriodEnd: string | null
    trialEndsAt: string | null
    cancelAtPeriodEnd: boolean
    lastPaymentStatus: string
    lastPaymentMethod: string | null
    billingInterval: string
  } | null
}

type DetailState = {
  tenant: { _id: string; name: string }
  subscription: any
  plan: any
  pendingPlan: any
  availablePlans: any[]
  access: any
  usage: any
  pricing: SubscriptionPricing | null
}

const PAYMENT_METHODS: { value: ManualPaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'complimentary', label: 'Complimentary / promo' },
  { value: 'other', label: 'Other' }
]

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'

  return iso.slice(0, 10)
}

export function SuperAdminTenantsManager() {
  const [tenants, setTenants] = useState<TenantRow[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailState | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const [planId, setPlanId] = useState('')
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')
  const [forceImmediate, setForceImmediate] = useState(false)
  const [trialDays, setTrialDays] = useState('14')
  const [payMethod, setPayMethod] = useState<ManualPaymentMethod>('cash')
  const [payNote, setPayNote] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [skipReferralCredit, setSkipReferralCredit] = useState(false)

  const loadTenants = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/super-admin/tenants${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`,
        { cache: 'no-store' }
      )
      const data = await res.json()

      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load organisations')
      setTenants(data.tenants || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load organisations')
    } finally {
      setLoading(false)
    }
  }, [q])

  useEffect(() => {
    void loadTenants()
  }, [loadTenants])

  const loadDetail = async (tenantId: string) => {
    setDetailLoading(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch(`/api/super-admin/tenants/${encodeURIComponent(tenantId)}/subscription`, {
        cache: 'no-store'
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.message || data?.error || 'Failed to load subscription')
      setDetail(data)
      setPlanId(data.plan?._id || data.availablePlans?.[0]?._id || '')
      setBillingInterval(data.subscription?.billingInterval === 'yearly' ? 'yearly' : 'monthly')
    } catch (e: any) {
      setError(e?.message || 'Failed to load subscription')
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  const openTenant = (id: string) => {
    setSelectedId(id)
    void loadDetail(id)
  }

  const postAction = async (body: Record<string, unknown>) => {
    if (!selectedId) return

    setBusy(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch(`/api/super-admin/tenants/${encodeURIComponent(selectedId)}/subscription`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.message || data?.error || 'Action failed')
      setInfo(data?.message || 'Updated')
      setPayOpen(false)
      await Promise.all([loadDetail(selectedId), loadTenants()])
    } catch (e: any) {
      setError(e?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const filteredHint = useMemo(() => {
    if (loading) return 'Loading…'
    if (tenants.length === 0) return 'No organisations found.'

    return `${tenants.length} organisation${tenants.length === 1 ? '' : 's'}`
  }, [loading, tenants.length])

  return (
    <Box className='flex flex-col gap-4'>
      <Box className='flex flex-col sm:flex-row sm:items-end justify-between gap-2'>
        <Box>
          <Typography variant='h5'>Organisations</Typography>
          <Typography variant='body2' color='text.secondary'>
            Assign plans, extend trials, cancel, and record offline payments for any organisation.
          </Typography>
        </Box>
        <Box className='flex gap-2 items-center'>
          <TextField
            size='small'
            label='Search'
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') void loadTenants()
            }}
          />
          <Button variant='outlined' onClick={() => void loadTenants()} disabled={loading}>
            Search
          </Button>
        </Box>
      </Box>

      {error ? (
        <Alert severity='error' onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}
      {info ? (
        <Alert severity='success' onClose={() => setInfo(null)}>
          {info}
        </Alert>
      ) : null}

      <Typography variant='caption' color='text.secondary'>
        {filteredHint}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1.2fr' },
          gap: 2,
          alignItems: 'start'
        }}
      >
        <Stack spacing={1.5}>
          {tenants.map(t => {
            const selected = selectedId === t._id

            return (
              <Card
                key={t._id}
                variant='outlined'
                sx={{
                  borderColor: selected ? 'primary.main' : 'divider',
                  cursor: 'pointer'
                }}
                onClick={() => openTenant(t._id)}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box className='flex items-start justify-between gap-2'>
                    <Box>
                      <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
                        {t.name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {t.subscriptionPlan?.name || 'No plan'} ·{' '}
                        {t.subscription?.status || 'no subscription'}
                      </Typography>
                    </Box>
                    <Chip
                      size='small'
                      label={t.status}
                      color={t.status === 'active' ? 'success' : 'default'}
                    />
                  </Box>
                  {t.subscription?.currentPeriodEnd ? (
                    <Typography variant='caption' color='text.secondary'>
                      Period ends {fmtDate(t.subscription.currentPeriodEnd)}
                      {t.subscription.lastPaymentStatus === 'succeeded'
                        ? ` · Paid (${t.subscription.lastPaymentMethod || 'manual'})`
                        : ''}
                    </Typography>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </Stack>

        <Card variant='outlined'>
          <CardContent className='flex flex-col gap-3'>
            {!selectedId ? (
              <Typography color='text.secondary'>Select an organisation to manage its subscription.</Typography>
            ) : detailLoading && !detail ? (
              <Typography>Loading subscription…</Typography>
            ) : detail ? (
              <>
                <Typography variant='h6'>{detail.tenant.name}</Typography>
                <Box className='flex flex-wrap gap-1'>
                  {detail.plan ? (
                    <Chip color='primary' label={detail.plan.name} icon={<i className='ri-vip-crown-line' />} />
                  ) : (
                    <Chip label='No plan' />
                  )}
                  {detail.subscription ? (
                    <Chip
                      label={detail.subscription.status}
                      color={detail.subscription.status === 'trialing' ? 'info' : 'default'}
                    />
                  ) : null}
                  {detail.subscription?.cancelAtPeriodEnd ? (
                    <Chip color='warning' label='Cancels at period end' />
                  ) : null}
                </Box>

                {detail.pricing?.discount ? (
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: 'success.light',
                      bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                    }}
                  >
                    <PayAmountDisplay pricing={detail.pricing} align='left' />
                  </Box>
                ) : detail.plan ? (
                  <Typography variant='body2' color='text.secondary'>
                    {formatPlanMoney(
                      detail.subscription?.billingInterval === 'yearly' && detail.plan.priceYearly
                        ? detail.plan.priceYearly
                        : detail.plan.priceMonthly,
                      detail.plan.currency
                    )}{' '}
                    / {detail.subscription?.billingInterval === 'yearly' ? 'year' : 'month'}
                  </Typography>
                ) : null}

                <Typography variant='body2' color='text.secondary'>
                  Period {fmtDate(detail.subscription?.currentPeriodStart)} →{' '}
                  {fmtDate(detail.subscription?.currentPeriodEnd)}
                  {detail.subscription?.trialEndsAt
                    ? ` · Trial ends ${fmtDate(detail.subscription.trialEndsAt)}`
                    : ''}
                </Typography>
                {detail.subscription?.lastPaymentStatus === 'succeeded' ? (
                  <Typography variant='body2' color='text.secondary'>
                    Last payment: {detail.subscription.lastPaymentMethod || 'manual'} on{' '}
                    {fmtDate(detail.subscription.lastPaymentAt)}
                    {detail.subscription.lastPaymentNote ? ` — ${detail.subscription.lastPaymentNote}` : ''}
                  </Typography>
                ) : null}

                {detail.pendingPlan ? (
                  <Alert severity='info'>
                    Pending switch to <strong>{detail.pendingPlan.name}</strong> on{' '}
                    {fmtDate(detail.subscription?.pendingChangeEffectiveAt)}.
                    <Button
                      size='small'
                      sx={{ ml: 1 }}
                      disabled={busy}
                      onClick={() => void postAction({ action: 'clear_pending' })}
                    >
                      Clear pending
                    </Button>
                  </Alert>
                ) : null}

                <Divider />

                <Typography variant='subtitle2'>Assign / change plan</Typography>
                <FormControl fullWidth size='small'>
                  <InputLabel>Plan</InputLabel>
                  <Select label='Plan' value={planId} onChange={e => setPlanId(String(e.target.value))}>
                    {(detail.availablePlans || []).map((p: any) => (
                      <MenuItem key={p._id} value={p._id}>
                        {p.name} · {formatPlanMoney(p.priceMonthly, p.currency)}
                        {p.changeKind && p.changeKind !== 'same' ? ` (${p.changeKind})` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size='small'>
                  <InputLabel>Billing interval</InputLabel>
                  <Select
                    label='Billing interval'
                    value={billingInterval}
                    onChange={e => setBillingInterval(e.target.value as 'monthly' | 'yearly')}
                  >
                    <MenuItem value='monthly'>Monthly</MenuItem>
                    <MenuItem value='yearly'>Yearly</MenuItem>
                  </Select>
                </FormControl>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={forceImmediate}
                      onChange={e => setForceImmediate(e.target.checked)}
                    />
                  }
                  label='Apply now (override period-end for downgrades/cancels)'
                />
                <Button
                  variant='contained'
                  disabled={busy || !planId}
                  onClick={() =>
                    void postAction({
                      action: 'change_plan',
                      planId,
                      billingInterval,
                      forceImmediate
                    })
                  }
                >
                  Apply plan
                </Button>

                <Divider />

                <Typography variant='subtitle2'>Extend trial (this organisation only)</Typography>
                <Typography variant='caption' color='text.secondary'>
                  Does not change the plan catalog trial days — only this org’s trial end date.
                </Typography>
                <Box className='flex gap-2 items-center'>
                  <TextField
                    size='small'
                    type='number'
                    label='Days'
                    value={trialDays}
                    onChange={e => setTrialDays(e.target.value)}
                    sx={{ width: 120 }}
                  />
                  <Button
                    variant='outlined'
                    disabled={busy}
                    onClick={() =>
                      void postAction({ action: 'extend_trial', days: Number(trialDays) })
                    }
                  >
                    Extend trial
                  </Button>
                </Box>

                <Divider />

                <Typography variant='subtitle2'>Payments & cancel</Typography>
                <Box className='flex flex-wrap gap-1'>
                  <Button
                    variant='outlined'
                    disabled={busy}
                    onClick={() => {
                      setSkipReferralCredit(false)
                      setPayNote('')
                      setPayOpen(true)
                    }}
                  >
                    Mark as paid
                  </Button>
                  {detail.subscription?.cancelAtPeriodEnd ? (
                    <Button
                      variant='outlined'
                      color='success'
                      disabled={busy}
                      onClick={() => void postAction({ action: 'resume' })}
                    >
                      Resume
                    </Button>
                  ) : (
                    <Button
                      variant='outlined'
                      color='warning'
                      disabled={busy || !detail.subscription}
                      onClick={() => void postAction({ action: 'cancel', forceImmediate })}
                    >
                      Cancel{forceImmediate ? ' now' : ' at period end'}
                    </Button>
                  )}
                </Box>
              </>
            ) : (
              <Typography color='error'>Could not load subscription.</Typography>
            )}
          </CardContent>
        </Card>
      </Box>

      <Dialog open={payOpen} onClose={() => (!busy ? setPayOpen(false) : undefined)} fullWidth maxWidth='xs'>
        <DialogTitle>Mark as paid</DialogTitle>
        <DialogContent className='flex flex-col gap-3 pt-2'>
          <Typography variant='body2' color='text.secondary'>
            Records an offline payment, issues a GST tax invoice (emailed to the billing contact, with GST billing email
            CC&apos;d when set), ends any remaining trial, and activates the paid subscription period from the later of
            now or the current period end.
          </Typography>
          {detail?.pricing ? (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: detail.pricing.discount ? 'success.light' : 'divider',
                bgcolor: detail.pricing.discount
                  ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                  : 'action.hover'
              }}
            >
              <PayAmountDisplay pricing={detail.pricing} align='left' />
            </Box>
          ) : null}
          <FormControl fullWidth>
            <InputLabel>Method</InputLabel>
            <Select
              label='Method'
              value={payMethod}
              onChange={e => setPayMethod(e.target.value as ManualPaymentMethod)}
            >
              {PAYMENT_METHODS.map(m => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label='Note (optional)'
            value={payNote}
            onChange={e => setPayNote(e.target.value)}
            fullWidth
            multiline
            minRows={2}
          />
          <FormControlLabel
            control={
              <Checkbox checked={skipReferralCredit} onChange={e => setSkipReferralCredit(e.target.checked)} />
            }
            label='Do not credit referral commission for this payment'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPayOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant='contained'
            disabled={busy}
            onClick={() =>
              void postAction({
                action: 'mark_paid',
                method: payMethod,
                note: payNote || null,
                skipReferralCredit
              })
            }
          >
            Confirm payment
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
