import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { DashboardHome } from '@features/dashboard'

type Membership = {
  userId: ObjectId
  tenantId: ObjectId
  role: 'OWNER' | 'ADMIN' | 'USER'
  status: 'invited' | 'active' | 'revoked'
  createdAt: Date
}

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')

  if (session.isSuperAdmin) {
    return (<DashboardHome />)
  }

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
      redirect('/create-tenant')
    }
  }


  return (<DashboardHome />)
}

export default Page
