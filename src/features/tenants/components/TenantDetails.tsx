'use client'

import { useEffect, useState } from 'react'

import useSWR from 'swr'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import { useSession } from 'next-auth/react'

import type { TenantSubscriptionSummary } from '@features/subscription-plans'
import { formatPlanMoney } from '@features/subscription-plans'

type TenantInfo = {
  _id: string
  name: string
  type: 'sole_trader' | 'company'
  status: 'active' | 'suspended'
  subscriptionPlanId?: string | null
  subscriptionPlan?: TenantSubscriptionSummary | null
  createdAt?: string
  updatedAt?: string
}

export const TenantDetails = ({ id }: { id: string }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const { data: session } = useSession()
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data: sessionTenant } = useSWR('/api/session/tenant', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  })
  const canManageSubscription = isSuperAdmin || sessionTenant?.role === 'OWNER'

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    fetch(`/api/tenants/${encodeURIComponent(id)}`, { cache: 'no-store' })
      .then(async res => {
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data?.error || 'Failed to load organisation')
        }

        setTenant(data.tenant as TenantInfo)
      })
      .catch(e => setError(e?.message || 'Failed to load organisation'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading && !tenant) return <Typography>Loading…</Typography>
  if (error) return <Typography color='error'>{error}</Typography>
  if (!tenant) return null

  const plan = tenant.subscriptionPlan ?? null

  return (
    <Box className='flex flex-col gap-4'>
      <Typography variant='h4'>{tenant.name}</Typography>
      <Card>
        <CardContent className='flex flex-col gap-3'>
          <Stack direction='row' spacing={2} alignItems='center' flexWrap='wrap' useFlexGap>
            <Chip label={`Type: ${tenant.type}`} />
            <Chip color={tenant.status === 'active' ? 'success' : 'warning'} label={`Status: ${tenant.status}`} />
          </Stack>
          <Typography variant='body2' color='text.secondary'>
            Created: {tenant.createdAt || '—'}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Updated: {tenant.updatedAt || '—'}
          </Typography>
          <Box className='flex items-center gap-2 flex-wrap'>
            <Button variant='outlined' href='/tenants'>
              Back to Organisations
            </Button>
            {canManageSubscription ? (
              <Button variant='contained' href='/admin/subscription' startIcon={<i className='ri-vip-crown-line' />}>
                Subscription & Billing
              </Button>
            ) : null}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent className='flex flex-col gap-3'>
          <Box className='flex items-center justify-between gap-2 flex-wrap'>
            <Typography variant='h6'>Subscription</Typography>
            {plan ? (
              <Chip color='primary' size='small' label={plan.name} icon={<i className='ri-vip-crown-line' />} />
            ) : (
              <Chip size='small' label='No plan' variant='outlined' />
            )}
          </Box>

          {plan ? (
            <>
              <Typography variant='body2' color='text.secondary'>
                {plan.description || 'Active subscription for this organisation.'}
              </Typography>
              <Divider />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} useFlexGap>
                <Box>
                  <Typography variant='caption' color='text.secondary'>
                    Monthly price
                  </Typography>
                  <Typography variant='h5'>
                    {formatPlanMoney(plan.priceMonthly, plan.currency)}
                    <Typography component='span' variant='subtitle2' color='text.secondary'>
                      /month
                    </Typography>
                  </Typography>
                </Box>
                {typeof plan.priceYearly === 'number' ? (
                  <Box>
                    <Typography variant='caption' color='text.secondary'>
                      Yearly price
                    </Typography>
                    <Typography variant='h5'>
                      {formatPlanMoney(plan.priceYearly, plan.currency)}
                      <Typography component='span' variant='subtitle2' color='text.secondary'>
                        /year
                      </Typography>
                    </Typography>
                  </Box>
                ) : null}
                <Box>
                  <Typography variant='caption' color='text.secondary'>
                    Max users
                  </Typography>
                  <Typography variant='h5'>{plan.maxUsers}</Typography>
                </Box>
              </Stack>
            </>
          ) : (
            <Typography variant='body2' color='text.secondary'>
              This organisation is not on a subscription plan yet.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}
