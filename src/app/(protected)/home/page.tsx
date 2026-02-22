import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { DashboardHome } from '@features/dashboard'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  
return (<DashboardHome />)
}

export default Page
