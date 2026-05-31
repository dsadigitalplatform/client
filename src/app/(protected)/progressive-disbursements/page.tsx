import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { ProgressiveDisbursementsList } from '@features/loan-disbursements'
import { authOptions } from '@/lib/auth'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as { currentTenantId?: string })?.currentTenantId

  if (!currentTenantId) redirect('/home')

  return <ProgressiveDisbursementsList />
}

export default Page
