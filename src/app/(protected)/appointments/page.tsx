import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import { LeadAppointmentsDashboard } from '@features/appointments'
import { authOptions } from '@/lib/auth'

const Page = async () => {
  const session = await getServerSession(authOptions)

  if (!session?.userId) redirect('/login')
  const currentTenantId = (session as any)?.currentTenantId as string | undefined

  if (!currentTenantId) redirect('/home')

  return <LeadAppointmentsDashboard />
}

export default Page

