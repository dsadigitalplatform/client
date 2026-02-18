'use client'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { useSession } from 'next-auth/react'

const DashboardHome = () => {
  const { data: session } = useSession()
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
  const tenantIds = ((session as any)?.tenantIds as string[] | undefined) || []
  const showWelcomeCta = tenantIds.length === 0

  return (
    <Box className='flex flex-col gap-4'>
      <Typography variant='h4'>Dashboard</Typography>
      <Typography color='text.secondary'>Welcome to your dashboard.</Typography>
      {showWelcomeCta && (
        <Box className='mt-4 flex flex-col gap-2'>
          <Typography variant='h6'>Welcome!</Typography>
          <Typography color='text.secondary'>
            Start by creating your organization to unlock your workspace.
          </Typography>
          <Button
            variant='contained'
            size='large'
            component={Link}
            href='/create-tenant'
            startIcon={<i className='ri-building-2-line' />}
          >
            Create Organization
          </Button>
        </Box>
      )}
    </Box>
  )
}

export default DashboardHome
