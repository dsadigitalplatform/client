'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Button from '@mui/material/Button'

type TenantInfo = {
  _id: string
  name: string
  type: 'sole_trader' | 'company'
  status: 'active' | 'suspended'
  subscriptionPlanId?: string | null
  createdAt?: string
  updatedAt?: string
}

export const TenantDetails = ({ id }: { id: string }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)

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

  return (
    <Box className='flex flex-col gap-4'>
      <Typography variant='h4'>{tenant.name}</Typography>
      <Card>
        <CardContent className='flex flex-col gap-3'>
          <Stack direction='row' spacing={2} alignItems='center'>
            <Chip label={`Type: ${tenant.type}`} />
            <Chip color={tenant.status === 'active' ? 'success' : 'warning'} label={`Status: ${tenant.status}`} />
            {tenant.subscriptionPlanId ? <Chip color='primary' label='Subscribed' /> : <Chip label='No Plan' />}
          </Stack>
          <Typography variant='body2' color='text.secondary'>
            Created: {tenant.createdAt || '—'}
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Updated: {tenant.updatedAt || '—'}
          </Typography>
          <Box className='flex items-center gap-2'>
            <Button variant='outlined' href='/tenants'>
              Back to Organisations
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}
