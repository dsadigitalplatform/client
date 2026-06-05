import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { ProgressiveDisbursementDetails } from '@features/loan-disbursements'
import { authOptions } from '@/lib/auth'

type Props = {
  params: Promise<{ id: string }>
}

const Page = async ({ params }: Props) => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as { currentTenantId?: string })?.currentTenantId

  if (!currentTenantId) redirect('/home')

  const { id } = await params

  return <ProgressiveDisbursementDetails trackerId={id} />
}

export default Page
