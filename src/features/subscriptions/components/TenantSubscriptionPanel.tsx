'use client'

import { useEffect, useState, type ReactNode } from 'react'

import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import {
  LIMIT_FEATURES,
  MODULE_FEATURES,
  isMonthlyLimit,
  isUnlimited,
  type PlanEntitlements
} from '@features/subscription-plans/featureCatalog'
import { SubscriptionPlanCard } from '@features/subscription-plans/components/SubscriptionPlanCard'
import type { TenantSubscriptionView } from '@features/subscriptions/subscriptions.types'
import {
  getSubscriptionStatusMessage,
  toSubscriptionStatusSummary
} from '@features/subscriptions/subscriptionStatusMessage'
import { TenantBillingProfileCard } from '@features/billing/components/TenantBillingProfileCard'
import { TenantInvoicesPanel } from '@features/billing/components/TenantInvoicesPanel'
import { UpiPaymentInstructions } from '@features/billing/components/UpiPaymentInstructions'
import { formatPlanMoney } from '@features/subscription-plans/currencies'

function usagePct(used: number, limit: number) {
  if (isUnlimited(limit) || limit <= 0) return 0

  return Math.min(100, Math.round((used / limit) * 100))
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function usageLimitLabel(key: string) {
  if (key === 'maxUsers') return 'Team seats'
  if (key === 'maxCustomers') return 'Customers this month'

  return 'Leads this month'
}

function changeKindLabel(kind: string | null | undefined) {
  if (kind === 'upgrade') return 'Upgrade'
  if (kind === 'downgrade') return 'Downgrade'
  if (kind === 'lateral') return 'Switch'
  if (kind === 'same') return 'Current'

  return null
}

export function TenantSubscriptionPanel() {
  const [data, setData] = useState<TenantSubscriptionView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [changingPlanId, setChangingPlanId] = useState<string | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [downgradeConfirm, setDowngradeConfirm] = useState<{
    planId: string
    planName: string
    effectiveAt: string
    usageWarnings: Array<{ key: string; used: number; limit: number; label: string }>
  } | null>(null)
  const [confirmAction, setConfirmAction] = useState<null | {
    type: 'clear_pending' | 'cancel_subscription'
    title: string
    description: ReactNode
    confirmLabel: string
    confirmColor: 'warning' | 'error'
  }>(null)
  const [billingContactUserId, setBillingContactUserId] = useState('')
  const [admins, setAdmins] = useState<Array<{ userId: string; name: string; role: string }>>([])
  const [invoiceRefreshKey] = useState(0)
  const [notifyNote, setNotifyNote] = useState('')
  const [notifying, setNotifying] = useState(false)

  const load = async (opts?: { preserveMessages?: boolean }) => {
    setLoading(true)
    if (!opts?.preserveMessages) setError(null)

    try {
      const res = await fetch('/api/tenant/subscription', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to load subscription')
      setData(json as TenantSubscriptionView)
      setBillingContactUserId(json?.subscription?.billingContactUserId || '')
      setAdmins(
        (json?.eligibleBillingContacts || []).map((c: any) => ({
          userId: String(c.userId),
          name: String(c.name || c.email || c.userId),
          role: String(c.role)
        }))
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to load subscription')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch('/api/tenant/subscription', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ renewalMode: 'manual', billingContactUserId: billingContactUserId || undefined })
      })
      const json = await res.json()

      if (!res.ok) throw new Error(json?.message || json?.error || 'Failed to save')
      setInfo('Billing preferences saved')
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const postChange = async (body: Record<string, unknown>) => {
    setActionBusy(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch('/api/tenant/subscription/change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      })
      const json = await res.json()

      if (!res.ok) {
        const blocks = Array.isArray(json?.usageBlocks)
          ? json.usageBlocks
              .map((b: any) => {
                const label =
                  b.key === 'maxUsers'
                    ? 'Team seats'
                    : b.key === 'maxCustomers'
                      ? 'Customers this month'
                      : 'Leads this month'
                const limitLabel = isMonthlyLimit(b.key) ? `${b.limit}/month` : b.limit

                return `${label}: using ${b.used}, plan allows ${limitLabel}`
              })
              .join('; ')
          : ''

        throw new Error(
          [json?.message || json?.error || 'Request failed', blocks].filter(Boolean).join(' — ')
        )
      }

      setDowngradeConfirm(null)
      await load({ preserveMessages: true })

      if (json?.mode === 'scheduled' && body?.action !== 'cancel' && body?.action !== 'clear_pending' && body?.action !== 'resume') {
        setInfo(
          json?.message ||
            'Downgrade activated. It will take effect on the date shown below. You can cancel the downgrade anytime before then.'
        )
      } else if (body?.action === 'clear_pending') {
        setInfo('Scheduled downgrade cancelled. You remain on your current plan.')
      } else {
        setInfo([json?.message, json?.prorationNote].filter(Boolean).join(' '))
      }
    } catch (e: any) {
      setError(e?.message || 'Request failed')
      setDowngradeConfirm(null)
    } finally {
      setActionBusy(false)
      setChangingPlanId(null)
    }
  }

  const openDowngradeConfirm = (plan: {
    _id: string
    name: string
    entitlements: PlanEntitlements
  }) => {
    const currentEnd = data?.subscription?.currentPeriodEnd
    const effective =
      currentEnd && new Date(currentEnd).getTime() > Date.now()
        ? currentEnd
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    const usageSnapshot = data?.usage
    const warnings: Array<{ key: string; used: number; limit: number; label: string }> = []

    if (usageSnapshot) {
      const checks = [
        { key: 'maxUsers', used: usageSnapshot.users, limit: plan.entitlements.limits.maxUsers },
        { key: 'maxCustomers', used: usageSnapshot.customers, limit: plan.entitlements.limits.maxCustomers },
        { key: 'maxLeads', used: usageSnapshot.leads, limit: plan.entitlements.limits.maxLeads }
      ]

      for (const check of checks) {
        if (!isUnlimited(check.limit) && check.used > check.limit) {
          warnings.push({ ...check, label: usageLimitLabel(check.key) })
        }
      }
    }

    setDowngradeConfirm({
      planId: plan._id,
      planName: plan.name,
      effectiveAt: effective,
      usageWarnings: warnings
    })
  }

  const notifySuperAdmin = async () => {
    setNotifying(true)
    setError(null)
    setInfo(null)

    try {
      const res = await fetch('/api/tenant/subscription/request-activation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ note: notifyNote.trim() || undefined })
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) throw new Error(json?.message || json?.error || 'Could not notify Super Admin')
      setInfo('Super Admin has been notified with your company, plan, and contact details.')
      setNotifyNote('')
    } catch (e: any) {
      setError(e?.message || 'Could not notify Super Admin')
    } finally {
      setNotifying(false)
    }
  }

  if (loading && !data) return <Typography>Loading subscription…</Typography>
  if (error && !data) return <Typography color='error'>{error}</Typography>
  if (!data) return null

  const entitlements = data.entitlements as PlanEntitlements
  const usage = data.usage
  const sub = data.subscription
  const access = data.access
  const copy = data.changePolicy?.copy
  const periodEndLabel = formatDate(sub?.currentPeriodEnd)
  const payAmountLabel = (() => {
    if (!data.plan) return null

    const yearly = sub?.billingInterval === 'yearly' && typeof data.plan.priceYearly === 'number'
    const amount = yearly ? data.plan.priceYearly : data.plan.priceMonthly
    const money = formatPlanMoney(amount, data.plan.currency)

    if (money === '—') return null

    return `${money} / ${yearly ? 'year' : 'month'}`
  })()
  const statusMessage = getSubscriptionStatusMessage(
    toSubscriptionStatusSummary({
      status: sub?.status,
      renewalMode: sub?.renewalMode,
      currentPeriodEnd: sub?.currentPeriodEnd,
      trialEndsAt: access.trialEndsAt || sub?.trialEndsAt,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd,
      daysLeftInTrial: access.daysLeftInTrial,
      inTrial: access.inTrial,
      pendingPlanName: data.pendingPlan?.name,
      pendingChangeEffectiveAt: sub?.pendingChangeEffectiveAt
    })
  )

  return (
    <Box className='flex flex-col gap-4'>
      <Box>
        <Typography variant='h4'>Subscription & billing</Typography>
        {statusMessage ? (
          <Typography variant='subtitle1' color='primary.main' sx={{ fontWeight: 600, mt: 0.75 }}>
            {statusMessage}
          </Typography>
        ) : null}
        <Typography variant='body2' color='text.secondary' sx={{ mt: statusMessage ? 0.5 : 0 }}>
          Manage plan, usage, renewals, and billing contact. Upgrades start a fresh trial on the higher plan;
          downgrades (when not in trial) and cancels take effect at period end. No automatic refunds.
        </Typography>
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

      {sub?.cancelAtPeriodEnd ? (
        <Alert
          severity='warning'
          action={
            data.canChangePlan ? (
              <Button color='inherit' size='small' disabled={actionBusy} onClick={() => void postChange({ action: 'resume' })}>
                Keep subscription
              </Button>
            ) : null
          }
        >
          <AlertTitle>Cancellation scheduled</AlertTitle>
          Access continues until {periodEndLabel}. {copy?.cancel}
        </Alert>
      ) : null}

      {sub?.pendingPlanId && data.pendingPlan ? (
        <Card
          variant='outlined'
          sx={{
            borderColor: 'warning.main',
            bgcolor: 'action.hover',
            borderWidth: 2
          }}
        >
          <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, alignItems: { sm: 'center' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction='row' spacing={1} alignItems='center' sx={{ mb: 0.75 }} flexWrap='wrap' useFlexGap>
                <Chip size='small' color='warning' icon={<i className='ri-arrow-down-circle-line' />} label='Downgrade activated' />
                <Chip
                  size='small'
                  variant='outlined'
                  color='warning'
                  label={`Takes effect ${formatDate(sub.pendingChangeEffectiveAt || sub.currentPeriodEnd)}`}
                />
              </Stack>
              <Typography variant='subtitle1' fontWeight={700}>
                Switching to {data.pendingPlan.name}
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                You activated a downgrade from {data.plan?.name || 'your current plan'} to{' '}
                <strong>{data.pendingPlan.name}</strong>. Until{' '}
                <strong>{formatDate(sub.pendingChangeEffectiveAt || sub.currentPeriodEnd)}</strong> you keep your
                current plan and limits. Use Cancel downgrade if you want to stay on {data.plan?.name || 'the current plan'}.
              </Typography>
            </Box>
            {data.canChangePlan ? (
              <Button
                color='warning'
                variant='contained'
                disabled={actionBusy}
                startIcon={<i className='ri-close-circle-line' />}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                onClick={() =>
                  setConfirmAction({
                    type: 'clear_pending',
                    title: 'Cancel scheduled downgrade?',
                    description: (
                      <>
                        You will stay on <strong>{data.plan?.name || 'your current plan'}</strong>. The scheduled switch
                        to <strong>{data.pendingPlan?.name}</strong> on{' '}
                        <strong>{formatDate(sub.pendingChangeEffectiveAt || sub.currentPeriodEnd)}</strong> will be
                        removed.
                      </>
                    ),
                    confirmLabel: 'Cancel downgrade',
                    confirmColor: 'warning'
                  })
                }
              >
                Cancel downgrade
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className='flex flex-col gap-3'>
          <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            {data.plan ? <Chip color='primary' label={data.plan.name} icon={<i className='ri-vip-crown-line' />} /> : <Chip label='No plan' />}
            {sub ? <Chip label={`Status: ${sub.status}`} color={sub.status === 'trialing' || sub.status === 'active' ? 'success' : 'warning'} /> : null}
            {access.inTrial ? <Chip color='info' label={`Trial · ${access.daysLeftInTrial ?? 0} days left`} /> : null}
            {sub?.pendingPlanId && data.pendingPlan ? (
              <Chip
                color='warning'
                icon={<i className='ri-arrow-down-circle-line' />}
                label={`Downgrade to ${data.pendingPlan.name} · ${formatDate(sub.pendingChangeEffectiveAt || sub.currentPeriodEnd)}`}
              />
            ) : null}
            {sub ? <Chip variant='outlined' label={sub.billingInterval === 'yearly' ? 'Yearly' : 'Monthly'} /> : null}
            {sub ? <Chip variant='outlined' label={sub.renewalMode === 'auto' ? 'Auto-renew' : 'Manual renew'} /> : null}
            {sub ? <Chip variant='outlined' label={`Period ends ${periodEndLabel}`} /> : null}
          </Stack>

          {data.plan ? (
            <Typography variant='body2' color='text.secondary'>
              {data.plan.description}
            </Typography>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              This organisation has no subscription yet. Choose a plan when creating an organisation, or ask a super
              admin to assign one.
            </Typography>
          )}

          {sub?.discountSnapshot ? (
            <Typography variant='body2'>
              Discount applied: <strong>{sub.discountSnapshot.code}</strong> (
              {sub.discountSnapshot.type === 'percent'
                ? `${sub.discountSnapshot.value}%`
                : `${sub.discountSnapshot.value} ${sub.discountSnapshot.currency || ''}`}
              )
            </Typography>
          ) : null}

          <Divider />

          <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
            Usage
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Seats are a standing total. Customers and leads reset every month
            {usage.monthlyWindow?.end ? ` (next reset ${formatDate(usage.monthlyWindow.end)})` : ''}.
          </Typography>
          <Box className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
            {LIMIT_FEATURES.map(f => {
              const limit = entitlements.limits[f.key]
              const used =
                f.key === 'maxUsers' ? usage.users : f.key === 'maxCustomers' ? usage.customers : usage.leads
              const monthly = isMonthlyLimit(f.key)

              return (
                <Box key={f.key}>
                  <Typography variant='caption' color='text.secondary'>
                    {f.label}
                    {monthly ? ' this month' : ' (total)'}
                  </Typography>
                  <Typography variant='body1'>
                    {used} / {isUnlimited(limit) ? '∞' : monthly ? `${limit}/mo` : limit}
                  </Typography>
                  <LinearProgress
                    variant='determinate'
                    value={usagePct(used, limit)}
                    sx={{ mt: 0.5, height: 6, borderRadius: 1 }}
                  />
                </Box>
              )
            })}
          </Box>

          <Divider />

          <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
            Modules
          </Typography>
          <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
            {MODULE_FEATURES.map(f => {
              const enabled = entitlements.modules[f.key]

              return (
                <Chip
                  key={f.key}
                  size='small'
                  color={enabled ? 'primary' : 'default'}
                  variant={enabled ? 'filled' : 'outlined'}
                  label={
                    f.status === 'coming_soon'
                      ? `${f.label} · Watch this space`
                      : `${f.label}: ${enabled ? 'On' : 'Off'}`
                  }
                />
              )
            })}
          </Stack>
        </CardContent>
      </Card>

      {data.canChangePlan ? (
        <Box className='flex flex-col gap-3'>
            <Box sx={{ maxWidth: 640 }}>
              <Typography variant='h5' sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
                {sub ? 'Change plan' : 'Choose a plan'}
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 1, lineHeight: 1.6 }}>
                {!sub
                  ? 'Pick a plan to start your trial. Paid access is activated only after Super Admin confirms payment.'
                  : access.inTrial
                    ? copy?.trialSwitch
                    : 'Upgrades apply immediately: remaining days on the current plan expire and a fresh trial starts on the higher plan. Downgrades are scheduled for period end.'}
              </Typography>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                gap: { xs: 2.5, md: 3 },
                alignItems: 'stretch',
                mt: 1
              }}
            >
              {(data.availablePlans || []).map(p => {
                const isCurrent = Boolean(sub) && p.changeKind === 'same'
                const kindLabel = changeKindLabel(p.changeKind)
                const pendingThis = Boolean(sub?.pendingPlanId === p._id)
                const trialBlocked =
                  (access.inTrial || sub?.status === 'trialing') && p.changeKind === 'downgrade'
                const busyThis = changingPlanId === p._id

                let actionLabel = 'Choose this plan'
                let actionVariant: 'contained' | 'outlined' = 'outlined'
                let actionIcon = <i className='ri-arrow-right-line' />

                if (busyThis) {
                  actionLabel = 'Updating…'
                } else if (!sub) {
                  actionLabel = 'Select plan'
                  actionVariant = 'contained'
                } else if (isCurrent) {
                  actionLabel = 'Current plan'
                  actionIcon = <i className='ri-check-line' />
                  actionVariant = 'contained'
                } else if (pendingThis) {
                  actionLabel = 'Downgrade scheduled'
                } else if (p.changeKind === 'upgrade') {
                  actionLabel = 'Upgrade & start trial'
                  actionVariant = 'contained'
                } else if (p.changeKind === 'downgrade') {
                  actionLabel = 'Schedule downgrade'
                } else {
                  actionLabel = 'Switch plan'
                }

                return (
                  <SubscriptionPlanCard
                    key={p._id}
                    plan={{
                      _id: p._id,
                      name: p.name,
                      description: p.description,
                      priceMonthly: p.priceMonthly,
                      priceYearly: p.priceYearly ?? null,
                      currency: p.currency,
                      entitlements: p.entitlements,
                      trialDays: p.trialDays,
                      trialEnabled: p.trialEnabled,
                      isDefault: p.isDefault
                    }}
                    highlighted={isCurrent}
                    recommended={Boolean(p.isDefault) && !isCurrent}
                    badges={
                      <>
                        {isCurrent ? <Chip size='small' color='primary' label='Current' sx={{ height: 26 }} /> : null}
                        {pendingThis ? (
                          <Chip
                            size='small'
                            color='warning'
                            label={`Downgrade · ${formatDate(sub?.pendingChangeEffectiveAt || sub?.currentPeriodEnd)}`}
                            sx={{ height: 26 }}
                          />
                        ) : null}
                        {sub && !isCurrent && !pendingThis && kindLabel ? (
                          <Chip
                            size='small'
                            variant='outlined'
                            color={
                              p.changeKind === 'upgrade'
                                ? 'success'
                                : p.changeKind === 'downgrade'
                                  ? 'warning'
                                  : 'default'
                            }
                            label={kindLabel}
                            sx={{ height: 26 }}
                          />
                        ) : null}
                      </>
                    }
                    primaryAction={
                      trialBlocked
                        ? undefined
                        : {
                            label: actionLabel,
                            variant: actionVariant,
                            disabled: actionBusy || isCurrent || pendingThis,
                            startIcon: actionIcon,
                            onClick: () => {
                              if (sub && p.changeKind === 'downgrade') {
                                openDowngradeConfirm({
                                  _id: p._id,
                                  name: p.name,
                                  entitlements: p.entitlements
                                })

                                return
                              }

                              setChangingPlanId(p._id)
                              void postChange({ action: 'change_plan', planId: p._id })
                            }
                          }
                    }
                    footer={
                      <>
                        {trialBlocked ? (
                          <Typography
                            variant='caption'
                            color='text.secondary'
                            sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}
                          >
                            Downgrade not available during trial
                          </Typography>
                        ) : null}
                        {pendingThis && data.canChangePlan ? (
                          <Button
                            fullWidth
                            color='warning'
                            variant='text'
                            size='small'
                            disabled={actionBusy}
                            sx={{ mt: 0.5 }}
                            onClick={() =>
                              setConfirmAction({
                                type: 'clear_pending',
                                title: 'Cancel scheduled downgrade?',
                                description: (
                                  <>
                                    You will stay on <strong>{data.plan?.name || 'your current plan'}</strong>. The
                                    scheduled switch to <strong>{p.name}</strong> will be removed.
                                  </>
                                ),
                                confirmLabel: 'Cancel downgrade',
                                confirmColor: 'warning'
                              })
                            }
                          >
                            Cancel this downgrade
                          </Button>
                        ) : null}
                      </>
                    }
                  />
                )
              })}
            </Box>

            {(data.availablePlans || []).length === 0 ? (
              <Alert severity='warning'>
                No active subscription plans are available. Ask a Super Admin to create plans under Super Admin →
                Subscription Plans.
              </Alert>
            ) : null}

            <Typography variant='caption' color='text.secondary'>
              {copy?.paymentsPending}
            </Typography>

            {sub ? (
              <>
                <Divider />
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                  {!sub.cancelAtPeriodEnd ? (
                    <Button
                      color='error'
                      variant='outlined'
                      disabled={actionBusy}
                      onClick={() =>
                        setConfirmAction({
                          type: 'cancel_subscription',
                          title: 'Cancel subscription at period end?',
                          description: (
                            <>
                              Your organisation will keep access until <strong>{periodEndLabel}</strong>. After that the
                              subscription expires. No refund is issued for unused time
                              {sub.billingInterval === 'yearly' ? ' on annual plans' : ''}.
                            </>
                          ),
                          confirmLabel: 'Cancel at period end',
                          confirmColor: 'error'
                        })
                      }
                    >
                      Cancel at period end
                    </Button>
                  ) : null}
                </Box>
              </>
            ) : null}
          </Box>
      ) : (
        <Alert severity='info'>
          Only the organisation <strong>Owner</strong> (or a Super Admin) can upgrade or change the plan. Open{' '}
          <strong>Admin → Subscription &amp; Billing</strong> while signed in as Owner.
        </Alert>
      )}

      {data.canManageBilling && sub ? (
        <Card>
          <CardContent className='flex flex-col gap-3'>
            <Typography variant='h6'>Payment & activation</Typography>
            <Alert severity='info'>
              <AlertTitle>Pay by UPI, then we activate</AlertTitle>
              {access.inTrial || sub.status === 'trialing'
                ? 'Use your selected plan during the trial. Pay the amount below by UPI and notify Super Admin with the UTR to start the paid period.'
                : sub.status === 'past_due' || sub.status === 'expired'
                  ? 'Paid access continues after Super Admin verifies your UPI transfer and marks payment received.'
                  : 'Renewals are confirmed by Super Admin after UPI payment is verified. Online checkout will return later.'}
            </Alert>

            <UpiPaymentInstructions
              amountLabel={payAmountLabel}
              organisationName={data.tenantName || null}
              planName={data.plan?.name || null}
            />

            <Typography variant='body2' color='text.secondary'>
              Already paid? Paste the UPI UTR / reference below. We will email Super Admin your company, plan, and
              requester details so they can mark payment received.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
              <TextField
                size='small'
                fullWidth
                label='UPI UTR / payment note'
                placeholder='e.g. UTR 123456789012 · paid via GPay'
                value={notifyNote}
                onChange={e => setNotifyNote(e.target.value)}
                disabled={notifying}
                inputProps={{ maxLength: 1000 }}
                helperText='Include the UTR from your UPI app. Organisation name in the UPI remark also helps us match the credit.'
              />
              <Button
                variant='contained'
                color='primary'
                disabled={notifying || actionBusy}
                startIcon={<i className='ri-mail-send-line' />}
                onClick={() => void notifySuperAdmin()}
                sx={{ whiteSpace: 'nowrap', flexShrink: 0, mt: { sm: 0.25 } }}
              >
                {notifying ? 'Sending…' : 'Notify Super Admin'}
              </Button>
            </Stack>
            {sub.lastPaymentStatus === 'failed' ? (
              <Alert severity='warning'>
                Last recorded payment failed. Ask Super Admin to verify and mark payment received.
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <TenantBillingProfileCard />

      <TenantInvoicesPanel refreshKey={invoiceRefreshKey} />

      {data.canManageBilling && sub ? (
        <Card>
          <CardContent className='flex flex-col gap-3'>
            <Typography variant='h6'>Billing preferences</Typography>
            <Typography variant='body2' color='text.secondary'>
              Renewal is manual for now. Reminders go out before the period ends. When Super Admin activates or renews,
              the invoice is emailed to the billing contact below, and the GST billing email (if set) is CC&apos;d.
            </Typography>

            <FormControl fullWidth>
              <InputLabel>Renewal mode</InputLabel>
              <Select
                label='Renewal mode'
                value='manual'
                disabled
              >
                <MenuItem value='manual'>Manual payment (with reminders)</MenuItem>
              </Select>
            </FormControl>

            {data.canNominateBillingContact ? (
              <FormControl fullWidth>
                <InputLabel>Billing contact</InputLabel>
                <Select
                  label='Billing contact'
                  value={billingContactUserId}
                  onChange={e => setBillingContactUserId(String(e.target.value))}
                >
                  {admins.map(a => (
                    <MenuItem key={a.userId} value={a.userId}>
                      {a.name} ({a.role})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : data.billingContact ? (
              <Typography variant='body2'>
                Billing contact: {data.billingContact.name || data.billingContact.email || data.billingContact.userId}
              </Typography>
            ) : null}

            <Box>
              <Button variant='contained' onClick={save} disabled={saving || !data.canNominateBillingContact}>
                {saving ? 'Saving…' : 'Save billing preferences'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(downgradeConfirm)} onClose={() => !actionBusy && setDowngradeConfirm(null)} fullWidth maxWidth='sm'>
        <DialogTitle>Confirm downgrade</DialogTitle>
        <DialogContent>
          <DialogContentText component='div' sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant='body1'>
              You are about to activate a downgrade to <strong>{downgradeConfirm?.planName}</strong>.
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              It will take effect on <strong>{formatDate(downgradeConfirm?.effectiveAt)}</strong>. Until then you keep
              your current plan and limits. When you return to this page you will see a <strong>Downgrade activated</strong>{' '}
              banner with a <strong>Cancel downgrade</strong> button.
            </Typography>
            {downgradeConfirm && downgradeConfirm.usageWarnings.length > 0 ? (
              <Alert severity='warning'>
                <AlertTitle>Usage is above this plan’s limits</AlertTitle>
                You can still schedule the downgrade, but reduce usage before{' '}
                {formatDate(downgradeConfirm.effectiveAt)} or new creates may be blocked after the switch:
                <Box component='ul' sx={{ m: 0, mt: 1, pl: 2.5 }}>
                  {downgradeConfirm.usageWarnings.map(w => (
                    <li key={w.key}>
                      {w.label}: using {w.used}, plan allows {isMonthlyLimit(w.key) ? `${w.limit}/month` : w.limit}
                    </li>
                  ))}
                </Box>
              </Alert>
            ) : (
              <Typography variant='body2' color='text.secondary'>
                No refund is issued for unused time on the current plan.
              </Typography>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDowngradeConfirm(null)} disabled={actionBusy}>
            Keep current plan
          </Button>
          <Button
            variant='contained'
            color='warning'
            disabled={actionBusy || !downgradeConfirm}
            onClick={() => {
              if (!downgradeConfirm) return
              setChangingPlanId(downgradeConfirm.planId)
              void postChange({ action: 'change_plan', planId: downgradeConfirm.planId })
            }}
          >
            {actionBusy ? 'Scheduling…' : 'Activate downgrade'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => !actionBusy && setConfirmAction(null)}
        fullWidth
        maxWidth='sm'
      >
        <DialogTitle>{confirmAction?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText component='div'>{confirmAction?.description}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} disabled={actionBusy}>
            Go back
          </Button>
          <Button
            variant='contained'
            color={confirmAction?.confirmColor || 'primary'}
            disabled={actionBusy || !confirmAction}
            onClick={() => {
              if (!confirmAction) return

              const action =
                confirmAction.type === 'clear_pending'
                  ? { action: 'clear_pending' as const }
                  : { action: 'cancel' as const }

              setConfirmAction(null)
              void postChange(action)
            }}
          >
            {actionBusy ? 'Working…' : confirmAction?.confirmLabel}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
