import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { DocumentChecklistsList } from '@features/document-checklists'
import { authOptions } from '@/lib/auth'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')

  return <DocumentChecklistsList />
}

export default Page
