import { redirect } from 'next/navigation'

import { getServerSession } from 'next-auth'

import AutoSetTenant from '@features/auth/components/AutoSetTenant'
import DemoPostLoginSetup from '@features/auth/components/DemoPostLoginSetup'
import { authOptions } from '@/lib/auth'
import { isDemoLoginEnabled } from '@/lib/demoLogin'

const PostLoginPage = async (props: { searchParams?: Promise<{ demo?: string | string[] }> }) => {
  const session = await getServerSession(authOptions)
  const sp = props.searchParams ? await props.searchParams : undefined
  const isDemoIntent = sp?.demo === '1' || sp?.demo === 'true'

  if (!session) redirect('/login')

  if (isDemoIntent && isDemoLoginEnabled()) {
    return <DemoPostLoginSetup />
  }

  if ((session as any).isSuperAdmin) redirect('/home')
  const tenantIds = ((session as any).tenantIds as string[] | undefined) || []

  if (tenantIds.length === 1) {
    return <AutoSetTenant id={tenantIds[0]} />
  }

  redirect('/home')
}

export default PostLoginPage
