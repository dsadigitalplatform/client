'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

const AutoSetTenant = ({ id }: { id: string }) => {
  const router = useRouter()

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const res = await fetch('/api/session/tenant?return=json', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ tenantId: id }).toString(),
          cache: 'no-store'
        })

        const data = await res.json().catch(() => ({}))

        if (active && res.ok && data?.success) {
          router.replace('/home')
        } else if (active) {
          router.replace('/home')
        }
      } catch {
        if (active) router.replace('/home')
      }
    })()

    
return () => {
      active = false
    }
  }, [id, router])

  return (
    <Box className='p-6'>
      <Typography>Setting up your organisation…</Typography>
    </Box>
  )
}

export default AutoSetTenant
