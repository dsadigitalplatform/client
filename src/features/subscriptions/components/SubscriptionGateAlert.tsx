'use client'

import { useMemo } from 'react'

import Link from 'next/link'

import useSWR from 'swr'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import { useSession } from 'next-auth/react'

type Props = {
  title: string
  message: string
  planName?: string | null
  detail?: string | null
}

export default function SubscriptionGateAlert({ title, message, planName, detail }: Props) {
  const { data: session } = useSession()
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())
  const { data: sessionTenant } = useSWR('/api/session/tenant', fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  })

  const canManageSubscription = useMemo(() => {
    return isSuperAdmin || sessionTenant?.role === 'OWNER'
  }, [isSuperAdmin, sessionTenant?.role])

  return (
    <Alert
      severity='info'
      icon={<i className='ri-vip-crown-line' style={{ fontSize: 22 }} />}
      action={
        canManageSubscription ? (
          <Button
            component={Link}
            href='/admin/subscription'
            color='inherit'
            size='small'
            variant='outlined'
            sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            View subscription
          </Button>
        ) : undefined
      }
      sx={{ alignItems: 'center' }}
    >
      <AlertTitle sx={{ fontWeight: 700, mb: 0.5 }}>{title}</AlertTitle>
      {message}
      {planName || detail ? (
        <Typography component='span' variant='body2' color='text.secondary' sx={{ display: 'block', mt: 0.75 }}>
          {[planName ? `Current plan: ${planName}` : null, detail].filter(Boolean).join(' · ')}
        </Typography>
      ) : null}
    </Alert>
  )
}
