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
    const email = (session.user?.email as string | undefined) || ''
    const now = new Date()
    const rx = email ? new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') : null
    const invited = rx
      ? await db
        .collection('memberships')
        .findOne({ email: rx, status: 'invited', expiresAt: { $gt: now } }, { projection: { role: 1 } })
      : null
    const activeByEmail = rx
      ? await db
        .collection('memberships')
        .findOne({ email: rx, status: 'active' }, { projection: { role: 1 } })
      : null
    const isUserRole =
      (invited && invited.role === 'USER') || (activeByEmail && activeByEmail.role === 'USER')
    if (!isUserRole) {
      redirect('/admin/create-tenant')
    }
  }

  const tenantIds = memberships.map(m => m.tenantId)
  const tenants = (await db
    .collection<Tenant>('tenants')
    .find({ _id: { $in: tenantIds } })
    .project({ name: 1 })
    .toArray()) as Tenant[]

  const byId = new Map<string, Tenant>(tenants.map(t => [t._id.toHexString(), t]))

  return (<DashboardHome />)
}

export default Page
