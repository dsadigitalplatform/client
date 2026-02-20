'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Chip from '@mui/material/Chip'

type TenantInfo = {
  _id: string
  name: string
}

export const OrganisationHeader = ({ title }: { title: string }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      try {
        const sRes = await fetch('/api/session/tenant', { cache: 'no-store' })
        const s = await sRes.json()
        const id = String(s?.currentTenantId || '')

        if (id) {
          const tRes = await fetch(`/api/tenants/${encodeURIComponent(id)}`, { cache: 'no-store' })
          const data = await tRes.json()

          if (tRes.ok && data?.tenant?._id) {
            setTenant({ _id: data.tenant._id, name: data.tenant.name })
          }
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  return (
    <Box className='flex flex-col gap-2'>
      <Breadcrumbs aria-label='breadcrumb'>
        <Typography color='text.secondary'>Admin</Typography>
        <Typography color='text.primary'>{title}</Typography>
      </Breadcrumbs>
      <Box className='flex items-center gap-2'>
        <Typography variant='h4'>{title}</Typography>
        {tenant ? <Chip label={`Organisation: ${tenant.name}`} /> : !loading ? <Chip label='Organisation: —' /> : null}
      </Box>
    </Box>
  )
}
