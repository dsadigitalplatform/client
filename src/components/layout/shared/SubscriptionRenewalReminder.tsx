'use client'

import { useMemo, useRef, useState } from 'react'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import Fade from '@mui/material/Fade'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Popper from '@mui/material/Popper'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { alpha } from '@mui/material/styles'

import {
  formatSubscriptionDueDate,
  getSubscriptionRenewalReminder,
  type SubscriptionStatusSummary
} from '@features/subscriptions/subscriptionStatusMessage'

type Props = {
  summary?: SubscriptionStatusSummary | null
  canManage?: boolean
}

function captionFor(kind: NonNullable<ReturnType<typeof getSubscriptionRenewalReminder>>['kind'], daysLeft: number) {
  if (kind === 'expired') return 'Plan expired'
  if (kind === 'overdue') return 'Payment overdue'
  if (kind === 'trial') {
    if (daysLeft <= 0) return 'Trial ends today'
    if (daysLeft === 1) return 'Trial ends tomorrow'

    return 'Trial ending'
  }
  if (kind === 'access_end') {
    if (daysLeft <= 0) return 'Access ends today'
    if (daysLeft === 1) return 'Access ends tomorrow'

    return 'Access ending'
  }
  if (daysLeft <= 0) return 'Renewal due today'
  if (daysLeft === 1) return 'Renewal due tomorrow'

  return 'Renewal due'
}

export default function SubscriptionRenewalReminder({ summary, canManage }: Props) {
  const [open, setOpen] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const reminder = useMemo(() => getSubscriptionRenewalReminder(summary), [summary])

  if (!reminder) return null

  const { daysLeft, severity, kind, dueAt } = reminder
  const isExpired = kind === 'expired' || daysLeft < 0
  const displayDays = Math.max(0, daysLeft)
  const dueLabel = formatSubscriptionDueDate(dueAt)
  const caption = captionFor(kind, daysLeft)
  const color = severity === 'error' ? 'error' : 'warning'

  const handleClose = () => {
    setOpen(false)
    setTooltipOpen(false)
  }

  const handleToggle = () => {
    setOpen(prev => !prev)
  }

  return (
    <>
      <Tooltip
        title={isExpired ? caption : `${displayDays}d · ${caption}`}
        arrow
        onOpen={() => setTooltipOpen(true)}
        onClose={() => setTooltipOpen(false)}
        open={open ? false : tooltipOpen}
      >
        <IconButton
          ref={anchorRef}
          color={color}
          size='small'
          aria-label={caption}
          aria-expanded={open}
          onClick={handleToggle}
          sx={{
            border: '1px solid',
            borderColor: theme => alpha(theme.palette[color].main, 0.45),
            bgcolor: theme => alpha(theme.palette[color].main, 0.08),
            boxShadow: 'var(--mui-customShadows-sm, 0px 4px 14px rgba(0,0,0,0.10))',
            minWidth: 34,
            px: displayDays > 9 || isExpired ? 0.75 : 0.5,
            gap: 0.35,
            borderRadius: 999,
            fontWeight: 700,
            fontSize: '0.75rem',
            lineHeight: 1
          }}
        >
          <i className={isExpired ? 'ri-error-warning-line' : 'ri-timer-line'} style={{ fontSize: 16 }} />
          {!isExpired ? (
            <Box component='span' sx={{ fontVariantNumeric: 'tabular-nums', pr: 0.25 }}>
              {displayDays}
            </Box>
          ) : null}
        </IconButton>
      </Tooltip>

      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='!mbs-3 z-[1]'
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <Paper
              elevation={8}
              sx={{
                width: 168,
                overflow: 'hidden',
                borderRadius: 2.5,
                border: '1px solid',
                borderColor: 'divider'
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <Box sx={{ textAlign: 'center', px: 2, pt: 2.25, pb: 1.75 }}>
                  <Typography
                    component='div'
                    sx={{
                      fontSize: isExpired ? '1.75rem' : '2.75rem',
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: '-0.04em',
                      fontVariantNumeric: 'tabular-nums',
                      color: `${color}.main`
                    }}
                  >
                    {isExpired ? '!' : displayDays}
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ display: 'block', mt: 0.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}
                  >
                    {isExpired ? 'Attention' : displayDays === 1 ? 'day left' : 'days left'}
                  </Typography>
                  <Typography variant='body2' sx={{ mt: 1.25, fontWeight: 600, lineHeight: 1.3 }}>
                    {caption}
                  </Typography>
                  {dueLabel && !isExpired ? (
                    <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.35 }}>
                      by {dueLabel}
                    </Typography>
                  ) : null}
                  {canManage ? (
                    <Button
                      component={Link}
                      href='/admin/subscription'
                      size='small'
                      color={color}
                      variant='text'
                      onClick={handleClose}
                      sx={{ mt: 1.25, fontWeight: 700, textTransform: 'none' }}
                    >
                      Manage plan
                    </Button>
                  ) : null}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}
