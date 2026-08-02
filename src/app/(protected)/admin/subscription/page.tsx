import { redirect } from 'next/navigation'

import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'
import Box from '@mui/material/Box'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { TenantSubscriptionPanel } from '@features/subscriptions/components/TenantSubscriptionPanel'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')

  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  if (!isSuperAdmin) {
    const store = await cookies()
    const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
    const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

    if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) redirect('/home')

    const db = await getDb()
    const userId = new ObjectId(session.userId)
    const tenantId = new ObjectId(tenantIdRaw)
    const email = String((session as any)?.user?.email || '')

    const emailFilter =
      email && email.length > 0
        ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
        : undefined

    const orFilters = [{ userId }] as any[]

    if (emailFilter) orFilters.push(emailFilter)

    const membership = await db.collection('memberships').findOne(
      { tenantId, status: 'active', $or: orFilters },
      { projection: { role: 1 } }
    )

    const role = String((membership as any)?.role || '')

    if (role !== 'OWNER') redirect('/home')
  }

  return (
    <Box sx={{ px: { xs: 0, sm: 6 }, py: { xs: 2, sm: 6 } }}>
      <TenantSubscriptionPanel />
    </Box>
  )
}

export default Page
