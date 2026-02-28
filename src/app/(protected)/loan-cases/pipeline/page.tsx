import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { LoanCasesPipelineDashboard } from '@features/loan-cases'
import { authOptions } from '@/lib/auth'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')

  return <LoanCasesPipelineDashboard />
}

export default Page

