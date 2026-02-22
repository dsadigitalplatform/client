'use client'

import { useMemo } from 'react'

import useSWR from 'swr'
import classnames from 'classnames'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

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

const NavbarContent = ({
  user,
  tenant,
  isSuperAdmin
}: {
  user?: UserInfo
  tenant?: TenantInfo
  isSuperAdmin?: boolean
}) => {
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())

  const { data: sessionTenant } = useSWR('/api/session/tenant', fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false
  })

  const tenantName = useMemo(() => {
    return (sessionTenant?.tenantName as string | undefined) || tenant?.tenantName
  }, [sessionTenant?.tenantName, tenant?.tenantName])

  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-4'>
        <NavToggle />
        <ModeDropdown />
      </div>
      <div className='flex items-center gap-2'>
        <div className='hidden sm:flex'>
          {tenantName ? (
            <Chip
              variant='outlined'
              color='primary'
              size='small'
              label={
                <Typography variant='subtitle2' noWrap title={tenantName}>
                  {tenantName}
                </Typography>
              }
              icon={<i className='ri-building-4-line' />}
            />
          ) : null}
        </div>
        <UserDropdown user={user} tenant={{ tenantName, role: tenant?.role }} isSuperAdmin={isSuperAdmin} />
      </div>
      <TenantSelectionGate />
    </div>
  )
}

export default NavbarContent
