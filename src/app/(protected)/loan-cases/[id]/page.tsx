import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { LoanCaseForm } from '@features/loan-cases'
import { authOptions } from '@/lib/auth'

const Page = async (props: { params: Promise<{ id: string }> }) => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')

  const { id } = await props.params

  return <LoanCaseForm caseId={id} />
}

export default Page

