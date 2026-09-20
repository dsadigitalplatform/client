'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import useSWR from 'swr'
import useMediaQuery from '@mui/material/useMediaQuery'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import {
  SUBSCRIPTION_TRIAL_DIALOG_DAYS,
  formatSubscriptionDueDate,
  getSubscriptionRenewalReminder,
  type SubscriptionRenewalReminder
} from '@features/subscriptions/subscriptionStatusMessage'

type Props = {
  /** Optional; when omitted the dialog loads /api/session/tenant itself. */
  canManage?: boolean
}

function headlineFor(
  reminder: SubscriptionRenewalReminder,
  wasTrial: boolean,
  planName: string | null
) {
  const daysLeft = reminder.daysLeft
  const planLabel = planName ? `Your ${planName}` : wasTrial ? 'Your trial' : 'Your plan'

  if (reminder.kind === 'expired' || reminder.kind === 'overdue') {
    return wasTrial ? 'Your trial has expired' : `${planLabel} has expired`
  }

  if (reminder.kind === 'access_end') {
    if (daysLeft <= 0) return 'Access ends today'
    if (daysLeft === 1) return 'Access ends tomorrow'

    return `Access ends in ${daysLeft} days`
  }

  if (wasTrial || reminder.kind === 'trial') {
    if (daysLeft <= 0) return 'Your trial ends today'
    if (daysLeft === 1) return 'Your trial ends tomorrow'

    return `Your trial ends in ${daysLeft} days`
  }

  if (daysLeft <= 0) return `${planLabel} ends today`
  if (daysLeft === 1) return `${planLabel} ends tomorrow`

  return `${planLabel} ends in ${daysLeft} days`
}

/**
 * Shows on every login/page load from 3 days before plan/trial end,
 * and after the plan has lapsed. Hidden on the billing page so owners can renew.
 */
export default function TrialExpiryReminderDialog({ canManage: canManageProp }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const pathname = usePathname()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data: sessionTenant } = useSWR('/api/session/tenant', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  })

  const canManage = useMemo(() => {
    if (typeof canManageProp === 'boolean') return canManageProp

    return sessionTenant?.role === 'OWNER'
  }, [canManageProp, sessionTenant?.role])

  const reminder = useMemo(
    () => getSubscriptionRenewalReminder(sessionTenant?.subscriptionSummary, new Date(), SUBSCRIPTION_TRIAL_DIALOG_DAYS),
    [sessionTenant?.subscriptionSummary]
  )

  const summary = sessionTenant?.subscriptionSummary
  const planName =
    typeof sessionTenant?.subscriptionPlan?.name === 'string' ? sessionTenant.subscriptionPlan.name : null
  const wasTrial = Boolean(summary?.inTrial || summary?.trialEndsAt || summary?.status === 'trialing')
  const lapsed =
    reminder?.kind === 'expired' ||
    reminder?.kind === 'overdue' ||
    summary?.isUsable === false ||
    summary?.status === 'expired' ||
    summary?.status === 'past_due' ||
    summary?.status === 'canceled'
  const onBillingPage = Boolean(pathname?.startsWith('/admin/subscription'))
  const eligible = Boolean(reminder)
  const open = eligible && !dismissed && !(lapsed && onBillingPage)

  if (!eligible || !reminder) return null

  const daysLeft = reminder.daysLeft
  const dueLabel = formatSubscriptionDueDate(reminder.dueAt)
  const showEndedDate = lapsed && daysLeft <= 0 && Boolean(dueLabel)
  const showUntilDate = !lapsed && Boolean(dueLabel)
  const urgency = lapsed || daysLeft <= 1 ? 'error' : 'warning'

  return (
    <Dialog
      open={open}
      onClose={() => setDismissed(true)}
      fullWidth
      fullScreen={isMobile}
      maxWidth='xs'
      aria-labelledby='trial-expiry-dialog-title'
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          m: isMobile ? 0 : 2
        }
      }}
    >
      <Box
        sx={{
          px: 3,
          pt: { xs: 4, sm: 3 },
          pb: 2,
          background: theme =>
            `linear-gradient(165deg, ${alpha(theme.palette[urgency].main, 0.12)} 0%, ${alpha(
              theme.palette[urgency].main,
              0.02
            )} 100%)`
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            mb: 2,
            bgcolor: theme => alpha(theme.palette[urgency].main, 0.14),
            color: `${urgency}.main`,
            border: '1px solid',
            borderColor: theme => alpha(theme.palette[urgency].main, 0.28)
          }}
        >
          <i className={lapsed ? 'ri-error-warning-line' : 'ri-timer-line'} style={{ fontSize: 26 }} />
        </Box>
        <Typography id='trial-expiry-dialog-title' variant='h5' sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          {headlineFor(reminder, wasTrial, planName)}
        </Typography>
        {showEndedDate ? (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
            Access ended on {dueLabel}.
          </Typography>
        ) : showUntilDate ? (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
            Access continues through {dueLabel}.
          </Typography>
        ) : lapsed ? (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
            Access has ended. Renew to keep working.
          </Typography>
        ) : null}
      </Box>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1, flex: isMobile ? 1 : undefined }}>
        <Typography variant='body1' sx={{ lineHeight: 1.55, fontWeight: 500 }}>
          {lapsed ? 'Please renew to restore access.' : 'Please renew to avoid interrupted service.'}
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1.5, lineHeight: 1.55 }}>
          {lapsed
            ? canManage
              ? 'Choose a plan and notify Super Admin after payment. Creating and updating records is paused until payment is confirmed.'
              : 'Ask the organisation owner to renew. Creating and updating records is paused until the plan is active again.'
            : wasTrial
              ? "Renewing today won't cost you any remaining trial days. Your paid plan starts after the trial ends."
              : 'Renewing now keeps this organisation on the same plan without a gap.'}
        </Typography>
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: { xs: 3, sm: 2.5 },
          pt: 1.5,
          gap: 1,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          alignItems: 'stretch'
        }}
      >
        <Button
          onClick={() => setDismissed(true)}
          color='inherit'
          fullWidth={isMobile}
          sx={{ fontWeight: 600, textTransform: 'none' }}
        >
          {lapsed ? 'OK' : 'Continue'}
        </Button>
        {canManage ? (
          <Button
            component={Link}
            href='/admin/subscription'
            variant='contained'
            color={urgency}
            fullWidth={isMobile}
            onClick={() => setDismissed(true)}
            sx={{ fontWeight: 700, textTransform: 'none' }}
          >
            Renew plan
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  )
}
