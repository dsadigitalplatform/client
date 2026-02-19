'use client'

import classnames from 'classnames'

import NavToggle from './NavToggle'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'
import { TenantSelectionGate } from '@features/tenants'

type UserInfo = {
  name?: string | null
  email?: string | null
  image?: string | null
}

type TenantInfo = {
  tenantName?: string
  role?: 'OWNER' | 'ADMIN' | 'USER'
}

const NavbarContent = ({ user, tenant }: { user?: UserInfo; tenant?: TenantInfo }) => {
  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-4'>
        <NavToggle />
        <ModeDropdown />
      </div>
      <div className='flex items-center'>
        <UserDropdown user={user} tenant={tenant} />
      </div>
      <TenantSelectionGate />
    </div>
  )
}

export default NavbarContent
