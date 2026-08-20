'use client'

import { useMemo, useState } from 'react'

import Link from 'next/link'

import useSWR from 'swr'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import {
  SUBSCRIPTION_TRIAL_DIALOG_DAYS,
  formatSubscriptionDueDate,
  getSubscriptionRenewalReminder
} from '@features/subscriptions/subscriptionStatusMessage'

type Props = {
  /** Optional; when omitted the dialog loads /api/session/tenant itself. */
  canManage?: boolean
}

function headlineFor(daysLeft: number) {
  if (daysLeft <= 0) return 'Your trial ends today'
  if (daysLeft === 1) return 'Your trial ends tomorrow'

  return `Your trial ends in ${daysLeft} days`
}

/**
 * Shows once per page load while trial is within SUBSCRIPTION_TRIAL_DIALOG_DAYS.
 * Dismiss is React state only — hard refresh / new tab shows it again.
 * (Avoids sessionStorage: Chrome session restore can keep those flags.)
 */
export default function TrialExpiryReminderDialog({ canManage: canManageProp }: Props) {
  const [dismissed, setDismissed] = useState(false)
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

  const trialReminder = reminder?.kind === 'trial' ? reminder : null
  const daysLeft = trialReminder ? Math.max(0, trialReminder.daysLeft) : null
  const dueLabel = trialReminder ? formatSubscriptionDueDate(trialReminder.dueAt) : null
  const eligible = daysLeft != null
  const open = eligible && !dismissed

  if (!eligible || daysLeft == null) return null

  const urgency = daysLeft <= 1 ? 'error' : 'warning'

  return (
    <Dialog
      open={open}
      onClose={() => setDismissed(true)}
      fullWidth
      maxWidth='xs'
      aria-labelledby='trial-expiry-dialog-title'
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider'
        }
      }}
    >
      <Box
        sx={{
          px: 3,
          pt: 3,
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
          <i className='ri-timer-line' style={{ fontSize: 26 }} />
        </Box>
        <Typography id='trial-expiry-dialog-title' variant='h5' sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          {headlineFor(daysLeft)}
        </Typography>
        {dueLabel ? (
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.75 }}>
            Access continues through {dueLabel}.
          </Typography>
        ) : null}
      </Box>

      <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
        <Typography variant='body1' sx={{ lineHeight: 1.55, fontWeight: 500 }}>
          Please renew to avoid interrupted service.
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1.5, lineHeight: 1.55 }}>
          Renewing today won't cost you any remaining trial days. Your paid plan starts after the trial ends.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5, gap: 1 }}>
        <Button onClick={() => setDismissed(true)} color='inherit' sx={{ fontWeight: 600, textTransform: 'none' }}>
          Continue
        </Button>
        {canManage ? (
          <Button
            component={Link}
            href='/admin/subscription'
            variant='contained'
            color={urgency}
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
