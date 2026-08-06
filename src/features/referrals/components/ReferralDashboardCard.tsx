'use client'

import { useEffect, useState } from 'react'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

import DashboardStatCard from '@features/dashboard/components/DashboardStatCard'
import { getMyRewards } from '../services/referralService'
import type { ReferralRewardsSummary } from '../referrals.types'

const formatINR = (n: number) => `₹ ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function ReferralDashboardCard() {
  const [summary, setSummary] = useState<ReferralRewardsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void getMyRewards()
      .then(res => {
        if (!cancelled) setSummary(res.summary)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <DashboardStatCard
      label='Referral rewards'
      value={loading ? '…' : formatINR(summary?.availableBalance || 0)}
      hint={
        loading
          ? 'Loading…'
          : `${summary?.openInvites || 0} open invite${(summary?.openInvites || 0) === 1 ? '' : 's'} · available to withdraw`
      }
      icon='ri-gift-line'
      accent='success'
      loading={loading}
      highlight={(summary?.availableBalance || 0) > 0}
      footer={
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Button component={Link} href='/rewards' size='small' variant='text' sx={{ px: 0.5, minWidth: 0 }}>
            Rewards
          </Button>
          <Button component={Link} href='/refer-and-earn' size='small' variant='text' sx={{ px: 0.5, minWidth: 0 }}>
            Refer
          </Button>
        </Box>
      }
    />
  )
}
