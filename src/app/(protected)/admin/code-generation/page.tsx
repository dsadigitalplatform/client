import { redirect } from 'next/navigation'

import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import CodeGenerationConfigPage from '@features/code-generation/components/CodeGenerationConfigPage'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const Page = async () => {
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

  return <CodeGenerationConfigPage />
}

export default Page
