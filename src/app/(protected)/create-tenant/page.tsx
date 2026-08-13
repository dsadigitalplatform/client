import { Suspense } from 'react'

import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { CreateTenantForm } from '@features/tenants'
import { getDb } from '@/lib/mongodb'

const CreateTenantPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')

  const db = await getDb()
  const userId = new ObjectId((session as any).userId)
  const isSuperAdmin = Boolean((session as any).isSuperAdmin)

  const activeMembership = await db
    .collection('memberships')
    .findOne({ userId, status: 'active' }, { sort: { createdAt: -1 }, projection: { role: 1 } })

  const hasActiveMembership = Boolean(activeMembership)

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 6 },
        py: { xs: 2, sm: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        maxWidth: 1200,
        mx: 'auto',
        width: '100%'
      }}
    >
      <Typography variant='h4' sx={{ fontWeight: 700, letterSpacing: '-0.02em' }}>
        Create organisation
      </Typography>
      <Typography color='text.secondary' sx={{ mb: 1, maxWidth: 640 }}>
        {hasActiveMembership
          ? 'Set up another organisation with a subscription plan that matches how you work.'
          : 'Get started by choosing a plan, then add your organisation details.'}
      </Typography>
      <Suspense
        fallback={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        }
      >
        <CreateTenantForm isSuperAdmin={isSuperAdmin} />
      </Suspense>
    </Box>
  )
}

export default CreateTenantPage
