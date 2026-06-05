'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { useSession } from 'next-auth/react'

import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'

const DemoPostLoginSetup = () => {
  const router = useRouter()
  const { update } = useSession()

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        const setupRes = await fetch('/api/auth/demo-setup', { method: 'POST', cache: 'no-store' })
        const setupData = await setupRes.json().catch(() => ({}))

        if (!active || !setupRes.ok || !setupData?.demoTenantId) {
          if (active) router.replace('/home')

          return
        }

        const demoTenantId = String(setupData.demoTenantId)

        await update({ demoMode: true, currentTenantId: demoTenantId } as any)

        const tenantRes = await fetch('/api/session/tenant?return=json', {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ tenantId: demoTenantId }).toString(),
          cache: 'no-store'
        })

        if (!active) return

        if (tenantRes.ok) {
          router.replace('/home')
        } else {
          router.replace('/home')
        }
      } catch {
        if (active) router.replace('/home')
      }
    })()

    return () => {
      active = false
    }
  }, [router, update])

  return (
    <Box className='p-6'>
      <Typography>Setting up demo organisation…</Typography>
    </Box>
  )
}

export default DemoPostLoginSetup
