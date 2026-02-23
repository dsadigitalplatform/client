export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'

import Button from '@mui/material/Button'

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
import { getMenuVisibility } from '@configs/menu'


const Layout = async (props: ChildrenType) => {
  const { children } = props
  const direction = 'ltr'
  const mode = await getMode()
  const systemMode = await getSystemMode()

  const session = await getServerSession(authOptions)
  let user
  let tenant
  let tenantPrimaryColor: string | undefined
  let hasMembership = false
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin)
  const tokenTenantIds = ((session as any)?.tenantIds as string[] | undefined) || []

  if (session?.userId) {
    user = {
      name: session.user?.name ?? null,
      email: session.user?.email ?? null,
      image: session.user?.image ?? null
    }
    const db = await getDb()

    const userIdObj = new ObjectId(session.userId)
    const email = String(session.user?.email || '')

    const emailFilter =
      email && email.length > 0
        ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
        : undefined

    const orFilters = [{ userId: userIdObj }] as any[]

    if (emailFilter) orFilters.push(emailFilter)
    const cookieStore = await cookies()
    const savedTenantId = cookieStore.get('CURRENT_TENANT_ID')?.value

    const memberships = await db
      .collection('memberships')
      .find({ status: 'active', $or: orFilters }, { sort: { createdAt: -1 }, projection: { tenantId: 1, role: 1 } })
      .toArray()

    hasMembership = memberships.length > 0 || Boolean(savedTenantId) || tokenTenantIds.length > 0

    // Selection prompt is handled in feature components when needed

    let active = memberships[0]

    if (savedTenantId && ObjectId.isValid(savedTenantId)) {
      const preferred = memberships.find(m => (m.tenantId as ObjectId).equals(new ObjectId(savedTenantId)))

      if (preferred) active = preferred
    }

    if (!active && savedTenantId && ObjectId.isValid(savedTenantId)) {
      const fallbackTenantId = new ObjectId(savedTenantId)

      const mem = await db
        .collection('memberships')
        .findOne({ userId: userIdObj, tenantId: fallbackTenantId, status: 'active' }, { projection: { role: 1 } })

      if (mem) {
        active = { tenantId: fallbackTenantId, role: (mem as any).role } as any
      }

      if (!active) {
        active = { tenantId: fallbackTenantId, role: undefined } as any
      }
    }


    // Fallback to first tenantId from JWT if we couldn't find any membership record yet
    if (!active && tokenTenantIds.length > 0 && ObjectId.isValid(tokenTenantIds[0])) {
      const fallbackTenantId = new ObjectId(tokenTenantIds[0])

      const mem = await db
        .collection('memberships')
        .findOne({ userId: userIdObj, tenantId: fallbackTenantId, status: 'active' }, { projection: { role: 1 } })

      if (mem) {
        active = { tenantId: fallbackTenantId, role: (mem as any).role } as any
      } else {
        active = { tenantId: fallbackTenantId, role: undefined } as any
      }
    }

    if (active) {
      const t = await db
        .collection('tenants')
        .findOne({ _id: active.tenantId as ObjectId }, { projection: { name: 1, 'theme.primaryColor': 1 } })

      tenant = {
        tenantName: (t?.name as string | undefined) || undefined,
        role: (active as any).role as 'OWNER' | 'ADMIN' | 'USER' | undefined
      }

      tenantPrimaryColor = ((t as any)?.theme?.primaryColor as string | undefined) || undefined
    }
  }

  const menuVisibility = getMenuVisibility({
    isSuperAdmin,
    tenantRole: tenant?.role,
    hasTenantSelected: Boolean(tenant?.tenantName) || Boolean(tenant)
  })


  return (
    <Providers direction={direction} tenantPrimaryColor={tenantPrimaryColor || null}>
      <LayoutWrapper
        systemMode={systemMode}
        verticalLayout={
          <VerticalLayout
            navigation={
              <Navigation
                mode={mode}
                tenant={tenant}
                isSuperAdmin={isSuperAdmin}
                hasMembership={hasMembership}
                menuVisibility={menuVisibility}
              />
            }
            navbar={<Navbar user={user} tenant={tenant} isSuperAdmin={isSuperAdmin} />}
            footer={<VerticalFooter />}
          >
            {children}
          </VerticalLayout>
        }
        horizontalLayout={
          <HorizontalLayout header={<Header user={user} tenant={tenant} isSuperAdmin={isSuperAdmin} />} footer={<HorizontalFooter />}>
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
