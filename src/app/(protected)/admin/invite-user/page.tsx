import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import InviteUserForm from '@features/tenants/components/InviteUserForm'

const Page = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')

  const db = await getDb()

  let role: 'OWNER' | 'ADMIN' | 'USER' | undefined

  if (session.currentTenantId) {
    const membership = await db
      .collection('memberships')
      .findOne(
        { userId: new ObjectId(session.userId), tenantId: new ObjectId(session.currentTenantId), status: 'active' },
        { projection: { role: 1 } }
      )
    role = membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined
  } else {
    const membership = await db
      .collection('memberships')
      .findOne({ userId: new ObjectId(session.userId), status: 'active' }, { sort: { createdAt: -1 }, projection: { role: 1 } })
    role = membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined
  }

  if (role !== 'OWNER') redirect('/home')

  return (
    <Box className='p-6 flex flex-col gap-4'>
      <Typography variant='h4'>Invite User</Typography>
      <InviteUserForm />
    </Box>
  )
}

export default Page
