import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { CustomersList } from '@features/customers'
import { authOptions } from '@/lib/auth'
 
const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const tenantIds = ((session as any)?.tenantIds as string[] | undefined) || []

  if (tenantIds.length === 0) redirect('/home')
  
return <CustomersList />
 }
 
 export default Page
