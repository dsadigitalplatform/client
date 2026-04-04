import { redirect } from 'next/navigation'

import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'
import Box from '@mui/material/Box'

import InviteUserForm from '@features/tenants/components/InviteUserForm'
import { OrganisationHeader } from '@features/tenants/components/OrganisationHeader'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const InviteUserPage = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')

  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  if (!isSuperAdmin) {
    const store = await cookies()
    const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
    const sessionTenantId = String((session as any)?.currentTenantId || '')
    const currentTenantId = cookieTenantId || sessionTenantId

    if (!currentTenantId || !ObjectId.isValid(currentTenantId)) redirect('/home')

    const db = await getDb()

    const membership = await db.collection('memberships').findOne(
      { tenantId: new ObjectId(currentTenantId), userId: new ObjectId(session.userId), status: 'active' },
      { projection: { role: 1 } }
    )

    const role = String((membership as any)?.role || '')

    if (role !== 'OWNER' && role !== 'ADMIN') redirect('/home')
  }

  return (
    <Box
      sx={{
        mx: { xs: -2, sm: 0 },
        px: { xs: 0, sm: 6 },
        py: { xs: 2, sm: 6 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <OrganisationHeader title='Invite Users' />
      <InviteUserForm />
    </Box>
  )
}

export default InviteUserPage
