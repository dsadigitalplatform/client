import Button from '@mui/material/Button'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'

import { ObjectId } from 'mongodb'

import type { ChildrenType } from '@core/types'
import LayoutWrapper from '@layouts/LayoutWrapper'
import VerticalLayout from '@layouts/VerticalLayout'
import HorizontalLayout from '@layouts/HorizontalLayout'
import Providers from '@components/Providers'
import Navigation from '@components/layout/vertical/Navigation'
import Header from '@components/layout/horizontal/Header'
import Navbar from '@components/layout/vertical/Navbar'
import VerticalFooter from '@components/layout/vertical/Footer'
import HorizontalFooter from '@components/layout/horizontal/Footer'
import ScrollToTop from '@core/components/scroll-to-top'
import { getMode, getSystemMode } from '@core/utils/serverHelpers'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'


const Layout = async (props: ChildrenType) => {
  const { children } = props
  const direction = 'ltr'
  const mode = await getMode()
  const systemMode = await getSystemMode()

  const session = await getServerSession(authOptions)
  let user
  let tenant
  let hasMembership = false
  let shouldPromptTenantSelection = false
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin)

  if (session?.userId) {
    user = {
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
      image: session.user?.image ?? null
    }
    const db = await getDb()

    const userIdObj = new ObjectId(session.userId)
    const cookieStore = await cookies()
    const savedTenantId = cookieStore.get('CURRENT_TENANT_ID')?.value
    const memberships = await db
      .collection('memberships')
      .find({ userId: userIdObj, status: 'active' }, { sort: { createdAt: -1 }, projection: { tenantId: 1, role: 1 } })
      .toArray()

    hasMembership = memberships.length > 0
    shouldPromptTenantSelection = !isSuperAdmin && memberships.length > 1 && !savedTenantId

    let active = memberships[0]
    if (savedTenantId && ObjectId.isValid(savedTenantId)) {
      const preferred = memberships.find(m => (m.tenantId as ObjectId).equals(new ObjectId(savedTenantId)))
      if (preferred) active = preferred
    }
    if (active) {
      const t = await db.collection('tenants').findOne({ _id: active.tenantId }, { projection: { name: 1 } })

      tenant = { tenantName: t?.name as string | undefined, role: active.role as 'OWNER' | 'ADMIN' | 'USER' }
    }
  }

  return (
    <Providers direction={direction}>
      <LayoutWrapper
        systemMode={systemMode}
        verticalLayout={
          <VerticalLayout
            navigation={<Navigation mode={mode} tenant={tenant} isSuperAdmin={isSuperAdmin} hasMembership={hasMembership} />}
            navbar={<Navbar user={user} tenant={tenant} />}
            footer={<VerticalFooter />}
          >
            {children}
          </VerticalLayout>
        }
        horizontalLayout={
          <HorizontalLayout header={<Header user={user} tenant={tenant} />} footer={<HorizontalFooter />}>
            {children}
          </HorizontalLayout>
        }
      />
      <ScrollToTop className='mui-fixed'>
        <Button variant='contained' className='is-10 bs-10 rounded-full p-0 min-is-0 flex items-center justify-center'>
          <i className='ri-arrow-up-line' />
        </Button>
      </ScrollToTop>
    </Providers>
  )
}

export default Layout
