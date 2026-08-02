'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { alpha, useTheme } from '@mui/material/styles'

import { listPublicPlans } from '../services/publicPlansService'
import { formatPlanMoney } from '../currencies'
import {
  LIMIT_FEATURES,
  MODULE_FEATURES,
  TRIAL_DAYS,
  isUnlimited,
  normalizePlanEntitlements,
  type LimitFeatureKey,
  type ModuleFeatureKey,
  type PlanEntitlements
} from '../featureCatalog'

type Plan = {
  _id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly?: number | null
  currency: string
  maxUsers: number
  trialDays?: number
  trialEnabled?: boolean
  isDefault: boolean
  entitlements: PlanEntitlements
}

type Props = {
  selectedPlanId?: string | null
  onSelect?: (planId: string, plan?: { name: string }) => void
}

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

export const SubscriptionPlansPicker = ({ selectedPlanId, onSelect }: Props) => {
  const theme = useTheme()
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)

      try {
        const res = await listPublicPlans()

        const list = (res.plans || []).map(p => ({
          _id: p._id,
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly ?? null,
          currency: p.currency || 'INR',
          maxUsers: p.maxUsers,
          trialDays: (p as any).trialDays ?? TRIAL_DAYS,
          trialEnabled: (p as any).trialEnabled !== false,
          isDefault: p.isDefault,
          entitlements: normalizePlanEntitlements((p as any).entitlements || p, p.maxUsers)
        }))

        setPlans(list)

        if (!selectedPlanId && onSelect) {
          const recommended = list.find(p => p.isDefault)

          if (recommended) onSelect(recommended._id, { name: recommended.name })
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load plans')
      } finally {
        setLoading(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectPlan = (plan: Plan) => {
    onSelect?.(plan._id, { name: plan.name })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3.5 }}>
      <Box sx={{ maxWidth: 560 }}>
        <Typography variant='h5' sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
          Choose a plan for this organisation
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 1, lineHeight: 1.6 }}>
          Pick what fits today. Limits and modules apply immediately; you can upgrade later when billing is connected.
        </Typography>
      </Box>

      {error ? (
        <Typography color='error' variant='body2'>
          {error}
        </Typography>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
          gap: { xs: 2.5, md: 3 },
          alignItems: 'stretch'
        }}
      >
        {loading
          ? [0, 1, 2].map(i => (
              <Card
                key={i}
                variant='outlined'
                sx={{ borderRadius: 3, boxShadow: 'none', borderColor: 'divider', minHeight: 420 }}
              >
                <CardContent sx={{ p: 3.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Skeleton width='36%' height={22} />
                  <Skeleton width='55%' height={32} />
                  <Skeleton width='90%' />
                  <Skeleton width='45%' height={48} sx={{ mt: 1 }} />
                  <Skeleton height={64} sx={{ borderRadius: 2 }} />
                  <Skeleton />
                  <Skeleton />
                  <Skeleton height={44} sx={{ mt: 'auto', borderRadius: 1.5 }} />
                </CardContent>
              </Card>
            ))
          : null}

        {!loading && plans.length === 0 ? (
          <Typography color='text.secondary'>No available plans yet. Ask a super admin to create one.</Typography>
        ) : null}

        {plans.map(p => {
          const selected = selectedPlanId === p._id
          const recommended = Boolean(p.isDefault)
          const entitlements = p.entitlements
          const hasTrial = p.trialEnabled !== false && (p.trialDays ?? TRIAL_DAYS) > 0
          const modules = MODULE_FEATURES.filter(f => entitlements.modules[f.key] || f.status === 'coming_soon')

          return (
            <Card
              key={p._id}
              variant='outlined'
              sx={{
                position: 'relative',
                height: '100%',
                borderRadius: 3,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: selected ? 'primary.main' : recommended ? alpha(theme.palette.primary.main, 0.45) : 'divider',
                bgcolor: 'background.paper',
                boxShadow: selected
                  ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.35)}, var(--mui-customShadows-sm, 0 4px 14px rgba(0,0,0,0.06))`
                  : recommended
                    ? `var(--mui-customShadows-sm, 0 4px 14px rgba(0,0,0,0.05))`
                    : 'none',
                transition: theme.transitions.create(['border-color', 'box-shadow'], {
                  duration: theme.transitions.duration.shorter
                }),
                '&:hover': {
                  borderColor: selected || recommended ? 'primary.main' : alpha(theme.palette.primary.main, 0.35),
                  boxShadow: 'var(--mui-customShadows-sm, 0 4px 14px rgba(0,0,0,0.06))'
                }
              }}
            >
              <CardActionArea
                onClick={() => selectPlan(p)}
                sx={{
                  height: '100%',
                  alignItems: 'stretch',
                  '.MuiCardActionArea-focusHighlight': { opacity: 0 }
                }}
              >
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
                  {/* Header */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                      <Typography
                        variant='overline'
                        color='text.secondary'
                        sx={{ letterSpacing: 1.2, lineHeight: 1 }}
                      >
                        Plan
                      </Typography>
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
                    </Box>
                    <Typography variant='h5' sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {p.name}
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
                      {p.description || 'Everything your organisation needs to run DSA operations.'}
                    </Typography>
                  </Box>

                  {/* Price */}
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                      <Typography variant='h3' sx={{ fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>
                        {formatPlanMoney(p.priceMonthly, p.currency)}
                      </Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ pb: 0.25 }}>
                        / month
                      </Typography>
                    </Box>
                    {typeof p.priceYearly === 'number' ? (
                      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.75 }}>
                        or {formatPlanMoney(p.priceYearly, p.currency)} billed yearly
                      </Typography>
                    ) : null}
                    <Box sx={{ mt: 1.75 }}>
                      {hasTrial ? (
                        <Chip
                          size='small'
                          color='success'
                          variant='outlined'
                          label={`${p.trialDays ?? TRIAL_DAYS}-day free trial`}
                          icon={<i className='ri-gift-line' style={{ fontSize: 14 }} />}
                          sx={{ height: 28, fontWeight: 500 }}
                        />
                      ) : (
                        <Chip size='small' variant='outlined' label='No free trial' sx={{ height: 28 }} />
                      )}
                    </Box>
                  </Box>

                  <Divider sx={{ borderStyle: 'dashed' }} />

                  {/* Limits with icons */}
                  <Box>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7 }}
                    >
                      Usage limits
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
                        const value = isUnlimited(entitlements.limits[f.key])
                          ? '∞'
                          : String(entitlements.limits[f.key])
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
                              <Typography
                                variant='subtitle1'
                                sx={{ fontWeight: 700, lineHeight: 1.1, fontSize: '1.05rem' }}
                              >
                                {value}
                              </Typography>
                              <Typography
                                variant='caption'
                                color='text.secondary'
                                sx={{ display: 'block', mt: 0.35, lineHeight: 1.2, fontWeight: 500 }}
                              >
                                {f.label.replace('Team seats', 'Seats')}
                              </Typography>
                            </Box>
                          </Box>
                        )
                      })}
                    </Box>
                  </Box>

                  {/* Modules */}
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

                  <Button
                    fullWidth
                    variant={selected ? 'contained' : 'outlined'}
                    color='primary'
                    size='large'
                    startIcon={<i className={selected ? 'ri-check-line' : 'ri-arrow-right-line'} />}
                    onClick={e => {
                      e.preventDefault()
                      e.stopPropagation()
                      selectPlan(p)
                    }}
                    sx={{ mt: 0.5, fontWeight: 600, py: 1.15 }}
                  >
                    {selected ? 'Selected' : 'Select plan'}
                  </Button>
                </CardContent>
              </CardActionArea>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}
