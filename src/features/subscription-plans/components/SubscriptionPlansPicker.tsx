'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Skeleton from '@mui/material/Skeleton'

import { listPublicPlans } from '../services/publicPlansService'
import {
  TRIAL_DAYS,
  normalizePlanEntitlements,
  type PlanEntitlements
} from '../featureCatalog'
import { SubscriptionPlanCard } from './SubscriptionPlanCard'

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

export const SubscriptionPlansPicker = ({ selectedPlanId, onSelect }: Props) => {
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

          return (
            <SubscriptionPlanCard
              key={p._id}
              plan={p}
              highlighted={selected}
              recommended={Boolean(p.isDefault)}
              onCardClick={() => selectPlan(p)}
              primaryAction={{
                label: selected ? 'Selected' : 'Select plan',
                onClick: () => selectPlan(p),
                variant: selected ? 'contained' : 'outlined',
                startIcon: <i className={selected ? 'ri-check-line' : 'ri-arrow-right-line'} />
              }}
            />
          )
        })}
      </Box>
    </Box>
  )
}
