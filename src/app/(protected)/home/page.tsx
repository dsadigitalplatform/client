import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

import { DashboardHome } from '@features/dashboard'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { ObjectId } from 'mongodb'

type Membership = {
  userId: ObjectId
  tenantId: ObjectId
  role: 'OWNER' | 'ADMIN' | 'USER'
  status: 'invited' | 'active' | 'revoked'
  createdAt: Date
}

type Tenant = {
  _id: ObjectId
  name: string
}

const Page = async () => {
  const session = await getServerSession(authOptions)
  if (!session?.userId) redirect('/login')

  const db = await getDb()
  const userId = new ObjectId(session.userId)

  const memberships = (await db
    .collection<Membership>('memberships')
    .find({ userId, status: 'active' })
    .toArray()) as Membership[]

  if (memberships.length === 0) {
    redirect('/create-tenant')
  }

  const tenantIds = memberships.map(m => m.tenantId)
  const tenants = (await db
    .collection<Tenant>('tenants')
    .find({ _id: { $in: tenantIds } })
    .project({ name: 1 })
    .toArray()) as Tenant[]

  const byId = new Map<string, Tenant>(tenants.map(t => [t._id.toHexString(), t]))

  return (
    <Box className='p-6 flex flex-col gap-2'>
      <Typography variant='h4'>Home</Typography>
      {memberships.map(m => {
        const t = byId.get(m.tenantId.toHexString())
        return (
          <Box key={m.tenantId.toHexString()} className='flex items-center gap-2'>
            <Typography color='text.primary'>{t?.name ?? 'Tenant'}</Typography>
            <Typography variant='caption' color='text.secondary'>
              Role: {m.role}
            </Typography>
          </Box>
        )
      })}
      <DashboardHome />
    </Box>
  )
}

export default Page
