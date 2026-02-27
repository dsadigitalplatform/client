'use client'

import { useEffect, useState } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Chip from '@mui/material/Chip'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

type TenantInfo = {
  _id: string
  name: string
}

export const OrganisationHeader = ({ title }: { title: string }) => {
  const [tenant, setTenant] = useState<TenantInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Breadcrumbs aria-label='breadcrumb' sx={{ display: { xs: 'none', sm: 'flex' } }}>
        <Typography color='text.secondary'>Admin</Typography>
        <Typography color='text.primary'>{title}</Typography>
      </Breadcrumbs>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { sm: 'center' },
          justifyContent: 'space-between',
          gap: { xs: 1, sm: 2 }
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          <Typography variant={isMobile ? 'h5' : 'h4'}>{title}</Typography>
          {isMobile ? (
            <Typography variant='body2' color='text.secondary'>
              Admin
            </Typography>
          ) : null}
        </Box>
        {tenant ? (
          <Chip size='small' variant='outlined' label={`Organisation: ${tenant.name}`} sx={{ width: 'fit-content' }} />
        ) : !loading ? (
          <Chip size='small' variant='outlined' label='Organisation: —' sx={{ width: 'fit-content' }} />
        ) : null}
      </Box>
    </Box>
  )
}
