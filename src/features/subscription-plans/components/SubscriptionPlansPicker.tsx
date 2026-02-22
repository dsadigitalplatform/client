'use client'

import { useEffect, useState } from 'react'

import type { MouseEvent } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'

import { listPublicPlans } from '../services/publicPlansService'

type Plan = {
  _id: string
  name: string
  description: string
  priceMonthly: number
  priceYearly?: number | null
  maxUsers: number
  isDefault: boolean
  features: Record<string, boolean>
}

type Props = {
  selectedPlanId?: string | null
  onSelect?: (planId: string) => void
}

export const SubscriptionPlansPicker = ({ selectedPlanId, onSelect }: Props) => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

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
          maxUsers: p.maxUsers,
          isDefault: p.isDefault,
          features: p.features || {}
        }))

        setPlans(list)
      } catch (e: any) {
        setError(e?.message || 'Failed to load plans')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleChoose = (id: string) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if (onSelect) onSelect(id)
  }

  return (
    <Box className='flex flex-col gap-3'>
      <Box className='flex items-center justify-between'>
        <Typography variant='h6'>Choose a Subscription Plan</Typography>
        {error ? <Typography color='error'>{error}</Typography> : null}
      </Box>
      <Box className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3'>
        {loading && plans.length === 0 && <Typography>Loading plans...</Typography>}
        {!loading && plans.length === 0 && (
          <Typography color='text.secondary'>No available plans</Typography>
        )}
        {plans.map(p => {
          const selected = selectedPlanId === p._id

          
return (
            <Card key={p._id} className={selected ? 'ring-2 ring-primary' : ''}>
              <CardContent className='flex flex-col gap-2'>
                <Box className='flex items-center justify-between'>
                  <Typography variant='h5'>{p.name}</Typography>
                  {p.isDefault ? <Chip label='Popular' size='small' color='primary' variant='outlined' /> : null}
                </Box>
                <Typography variant='body2' color='text.secondary'>
                  {p.description}
                </Typography>
                <Typography variant='h4'>${p.priceMonthly}<Typography component='span' variant='subtitle2'>/month</Typography></Typography>
                <Typography variant='body2' color='text.secondary'>
                  Max users: {p.maxUsers}
                </Typography>
                <Divider />
                <Box className='flex flex-col gap-1'>
                  {Object.keys(p.features || {}).length === 0 ? (
                    <Typography color='text.secondary' variant='body2'>No feature highlights</Typography>
                  ) : (
                    Object.entries(p.features)
                      .filter(([, enabled]) => Boolean(enabled))
                      .slice(0, 5)
                      .map(([label]) => (
                        <Box key={label} className='flex items-center gap-2'>
                          <i className='ri-check-line' />
                          <Typography variant='body2'>{label}</Typography>
                        </Box>
                      ))
                  )}
                </Box>
                <Button
                  variant={selected ? 'contained' : 'outlined'}
                  color='primary'
                  onClick={handleChoose(p._id)}
                >
                  {selected ? 'Selected' : 'Choose'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </Box>
    </Box>
  )
}
