'use client'

import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import { formatPlanMoney } from '../currencies'
import {
  LIMIT_FEATURES,
  MODULE_FEATURES,
  TRIAL_DAYS,
  isUnlimited,
  limitResetCaption,
  type LimitFeatureKey,
  type ModuleFeatureKey,
  type PlanEntitlements
} from '../featureCatalog'

const LIMIT_ICONS: Record<LimitFeatureKey, { icon: string; color: 'primary' | 'info' | 'success' }> = {
  maxUsers: { icon: 'ri-team-line', color: 'primary' },
  maxCustomers: { icon: 'ri-user-heart-line', color: 'info' },
  maxLeads: { icon: 'ri-briefcase-4-line', color: 'success' }
}

const MODULE_ICONS: Record<ModuleFeatureKey, string> = {
  reports: 'ri-bar-chart-box-line',
  progressiveDisbursement: 'ri-funds-line',
  associateCommission: 'ri-hand-coin-line'
}

export type SubscriptionPlanCardPlan = {
  _id: string
  name: string
  description?: string | null
  priceMonthly: number
  priceYearly?: number | null
  currency: string
  entitlements: PlanEntitlements
  trialDays?: number | null
  trialEnabled?: boolean | null
  isDefault?: boolean
}

type Props = {
  plan: SubscriptionPlanCardPlan
  /** Emphasize card (selected / current) */
  highlighted?: boolean
  recommended?: boolean
  /** Extra chips in the header row (Current, Upgrade, etc.) */
  badges?: ReactNode
  /** Footer under the primary action */
  footer?: ReactNode
  primaryAction?: {
    label: string
    onClick: () => void
    disabled?: boolean
    variant?: 'contained' | 'outlined'
    startIcon?: ReactNode
  }
  /** Whole card clickable (org create picker) */
  onCardClick?: () => void
}

export function SubscriptionPlanCard({
  plan,
  highlighted = false,
  recommended = false,
  badges,
  footer,
  primaryAction,
  onCardClick
}: Props) {
  const theme = useTheme()
  const entitlements = plan.entitlements
  const hasTrial = plan.trialEnabled !== false && (plan.trialDays ?? TRIAL_DAYS) > 0
  const trialDays = plan.trialDays ?? TRIAL_DAYS
  const modules = MODULE_FEATURES.filter(f => entitlements.modules[f.key] || f.status === 'coming_soon')
  const emphasize = highlighted || recommended

  const content = (
    <CardContent
      sx={{
        position: 'relative',
        px: { xs: 2.5, sm: 3.5 },
        py: { xs: 3, sm: 3.5 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2.75
      }}
    >
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
          <Typography variant='overline' color='text.secondary' sx={{ letterSpacing: 1.2, lineHeight: 1 }}>
            Plan
          </Typography>
          <Stack direction='row' spacing={0.75} flexWrap='wrap' useFlexGap justifyContent='flex-end'>
            {recommended ? (
              <Chip
                size='small'
                label='Recommended'
                icon={<i className='ri-star-smile-line' style={{ fontSize: 14 }} />}
                sx={{
                  height: 26,
                  fontWeight: 600,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  border: '1px solid',
                  borderColor: alpha(theme.palette.primary.main, 0.18),
                  '& .MuiChip-icon': { color: 'primary.main' }
                }}
              />
            ) : null}
            {badges}
          </Stack>
        </Box>
        <Typography variant='h5' sx={{ fontWeight: 700, lineHeight: 1.3 }}>
          {plan.name}
        </Typography>
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{
            mt: 1.25,
            lineHeight: 1.55,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: 44
          }}
        >
          {plan.description || 'Everything your organisation needs to run DSA operations.'}
        </Typography>
      </Box>

      <Box>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography variant='h3' sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
            {formatPlanMoney(plan.priceMonthly, plan.currency)}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ pb: 0.25 }}>
            / month
          </Typography>
        </Box>
        {typeof plan.priceYearly === 'number' ? (
          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.75 }}>
            or {formatPlanMoney(plan.priceYearly, plan.currency)} billed yearly
          </Typography>
        ) : null}
        <Box sx={{ mt: 1.75 }}>
          {hasTrial ? (
            <Chip
              size='small'
              color='success'
              variant='outlined'
              label={`${trialDays}-day free trial`}
              icon={<i className='ri-gift-line' style={{ fontSize: 14 }} />}
              sx={{ height: 28, fontWeight: 500 }}
            />
          ) : (
            <Chip size='small' variant='outlined' label='No free trial' sx={{ height: 28 }} />
          )}
        </Box>
      </Box>

      <Divider sx={{ borderStyle: 'dashed' }} />

      <Box>
        <Typography
          variant='caption'
          color='text.secondary'
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}
        >
          Usage limits
        </Typography>
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.75, lineHeight: 1.45 }}>
          Seats are a standing total. Customers and leads reset every month.
        </Typography>
        <Box
          sx={{
            mt: 1.75,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 1.25
          }}
        >
          {LIMIT_FEATURES.map(f => {
            const meta = LIMIT_ICONS[f.key]
            const value = isUnlimited(entitlements.limits[f.key]) ? '∞' : String(entitlements.limits[f.key])
            const tone = theme.palette[meta.color].main

            return (
              <Box
                key={f.key}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: 1,
                  px: 1,
                  py: 1.5,
                  borderRadius: 2.5,
                  bgcolor: alpha(tone, 0.08),
                  border: '1px solid',
                  borderColor: alpha(tone, 0.14)
                }}
              >
                <Box
                  sx={{
                    width: 40,
                    height: 40,
                    borderRadius: '12px',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: alpha(tone, 0.14),
                    color: tone
                  }}
                >
                  <i className={meta.icon} style={{ fontSize: 20, lineHeight: 1 }} />
                </Box>
                <Box>
                  <Typography variant='subtitle1' sx={{ fontWeight: 700, lineHeight: 1.1, fontSize: '1.05rem' }}>
                    {value}
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ display: 'block', mt: 0.35, lineHeight: 1.2, fontWeight: 500 }}
                  >
                    {f.label.replace('Team seats', 'Seats')}
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ display: 'block', mt: 0.2, lineHeight: 1.2, fontSize: '0.65rem', fontWeight: 600 }}
                  >
                    {limitResetCaption(f.key)}
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>

      <Box sx={{ flex: 1 }}>
        <Typography
          variant='caption'
          color='text.secondary'
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}
        >
          Included modules
        </Typography>
        <Stack spacing={1.25} sx={{ mt: 1.75 }}>
          {modules.length === 0 ? (
            <Typography variant='body2' color='text.secondary'>
              Core DSA workspace
            </Typography>
          ) : (
            modules.map(f => {
              const on = entitlements.modules[f.key]
              const comingSoon = f.status === 'coming_soon'

              return (
                <Box
                  key={f.key}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 1.25,
                    py: 1,
                    borderRadius: 2,
                    bgcolor: 'action.hover'
                  }}
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '10px',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      bgcolor: on
                        ? alpha(theme.palette.success.main, 0.14)
                        : alpha(theme.palette.warning.main, 0.14),
                      color: on ? 'success.main' : 'warning.main'
                    }}
                  >
                    <i className={MODULE_ICONS[f.key]} style={{ fontSize: 17, lineHeight: 1 }} />
                  </Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant='body2' sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                      {f.label}
                    </Typography>
                    {comingSoon ? (
                      <Typography variant='caption' color='warning.main' sx={{ fontWeight: 500 }}>
                        Watch this space
                      </Typography>
                    ) : null}
                  </Box>
                  <i
                    className={on ? 'ri-checkbox-circle-fill' : 'ri-time-line'}
                    style={{
                      fontSize: 18,
                      color: on ? theme.palette.success.main : theme.palette.warning.main
                    }}
                  />
                </Box>
              )
            })
          )}
        </Stack>
      </Box>

      {primaryAction ? (
        <Button
          fullWidth
          variant={primaryAction.variant || (highlighted ? 'contained' : 'outlined')}
          color='primary'
          size='large'
          disabled={primaryAction.disabled}
          startIcon={primaryAction.startIcon}
          onClick={e => {
            e.preventDefault()
            e.stopPropagation()
            primaryAction.onClick()
          }}
          sx={{ mt: 0.5, fontWeight: 600, py: 1.15 }}
        >
          {primaryAction.label}
        </Button>
      ) : null}

      {footer}
    </CardContent>
  )

  return (
    <Card
      variant='outlined'
      sx={{
        position: 'relative',
        height: '100%',
        borderRadius: 3,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: highlighted
          ? 'primary.main'
          : recommended
            ? alpha(theme.palette.primary.main, 0.45)
            : 'divider',
        bgcolor: 'background.paper',
        boxShadow: highlighted
          ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}, var(--mui-customShadows-sm, 0 4px 14px rgba(0,0,0,0.06))`
          : emphasize
            ? `var(--mui-customShadows-sm, 0 4px 14px rgba(0,0,0,0.05))`
            : 'none',
        transition: theme.transitions.create(['border-color', 'box-shadow'], {
          duration: theme.transitions.duration.shorter
        }),
        '&:hover': {
          borderColor: highlighted || recommended ? 'primary.main' : alpha(theme.palette.primary.main, 0.35),
          boxShadow: 'var(--mui-customShadows-sm, 0 4px 14px rgba(0,0,0,0.06))'
        }
      }}
    >
      {onCardClick ? (
        <CardActionArea
          onClick={onCardClick}
          sx={{
            height: '100%',
            alignItems: 'stretch',
            '.MuiCardActionArea-focusHighlight': { opacity: 0 }
          }}
        >
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  )
}
