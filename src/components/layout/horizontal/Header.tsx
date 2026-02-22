'use client'

import Navigation from './Navigation'
import NavbarContent from './NavbarContent'
import Navbar from '@layouts/components/horizontal/Navbar'
import LayoutHeader from '@layouts/components/horizontal/Header'
import useHorizontalNav from '@menu/hooks/useHorizontalNav'

type UserInfo = {
  name?: string | null
  email?: string | null
  image?: string | null
}

type TenantInfo = {
  tenantName?: string
  role?: 'OWNER' | 'ADMIN' | 'USER'
}

const Header = ({
  user,
  tenant,
  isSuperAdmin
}: {
  user?: UserInfo
  tenant?: TenantInfo
  isSuperAdmin?: boolean
}) => {
  const { isBreakpointReached } = useHorizontalNav()

  return (
    <>
      <LayoutHeader>
        <Navbar>
          <NavbarContent user={user} tenant={tenant} isSuperAdmin={isSuperAdmin} />
        </Navbar>
        {!isBreakpointReached && <Navigation />}
      </LayoutHeader>
      {isBreakpointReached && <Navigation />}
    </>
  )
}

export default Header
