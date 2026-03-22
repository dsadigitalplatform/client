'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

import useSWR from 'swr'
import classnames from 'classnames'
import Box from '@mui/material/Box'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Collapse from '@mui/material/Collapse'

import NavToggle from './NavToggle'
import Logo from '@components/layout/shared/Logo'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'
import useHorizontalNav from '@menu/hooks/useHorizontalNav'
import { horizontalLayoutClasses } from '@layouts/utils/layoutClasses'
import { getCustomers } from '@features/customers/services/customersService'
import type { Customer } from '@features/customers/customers.types'

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
  const { isBreakpointReached } = useHorizontalNav()
  const router = useRouter()
  const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json())

  const { data: sessionTenant } = useSWR('/api/session/tenant', fetcher, {
    revalidateOnFocus: true,
    shouldRetryOnError: false
  })

  const tenantName = useMemo(() => {
    return (sessionTenant?.tenantName as string | undefined) || tenant?.tenantName
  }, [sessionTenant?.tenantName, tenant?.tenantName])

  const [searchOpen, setSearchOpen] = useState(false)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerInputValue, setCustomerInputValue] = useState('')
  const [customerOptions, setCustomerOptions] = useState<Customer[]>([])
  const [customerLoading, setCustomerLoading] = useState(false)

  useEffect(() => {
    let active = true
    const query = customerQuery.trim()

    if (!query) {
      setCustomerOptions([])
      setCustomerLoading(false)

      return () => {
        active = false
      }
    }

    setCustomerLoading(true)

    const handle = setTimeout(async () => {
      try {
        const data = await getCustomers({ q: query })

        if (!active) return
        setCustomerOptions(data as Customer[])
      } catch {
        if (active) setCustomerOptions([])
      } finally {
        if (active) setCustomerLoading(false)
      }
    }, 250)

    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [customerQuery])

  return (
    <div className={classnames(horizontalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-4'>
        <NavToggle />
        {!isBreakpointReached && <Logo />}
      </div>
      <div className='flex items-center gap-2'>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: { xs: 1, sm: 'initial' }, justifyContent: { xs: 'flex-end', sm: 'flex-start' } }}>
          <Collapse in={searchOpen} orientation='horizontal' timeout={220} unmountOnExit sx={{ display: 'flex' }}>
            <Box sx={{ pr: 0.75, display: 'flex' }}>
              <Autocomplete
                options={customerOptions}
                loading={customerLoading}
                filterOptions={x => x}
                getOptionLabel={o => `${o.fullName}${o.mobile ? ` (${o.mobile})` : ''}`}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                onChange={(_, v) => {
                  if (!v) return
                  router.push(`/customers/${v.id}`)
                  setCustomerInputValue('')
                  setCustomerQuery('')
                  setCustomerOptions([])
                  setSearchOpen(false)
                }}
                inputValue={customerInputValue}
                onInputChange={(_, v, reason) => {
                  setCustomerInputValue(v)
                  if (reason === 'input') setCustomerQuery(v)

                  if (reason === 'clear') {
                    setCustomerQuery('')
                    setCustomerOptions([])
                  }
                }}
                noOptionsText={customerQuery.trim() ? 'No customers found' : 'Type a name, email, or mobile'}
                renderOption={(props, option) => (
                  <Box component='li' {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                    <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 12, fontWeight: 700 }}>
                      {option.fullName?.charAt(0)?.toUpperCase() || 'C'}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='body2' sx={{ fontWeight: 700 }} noWrap>
                        {option.fullName}
                      </Typography>
                      <Typography variant='caption' color='text.secondary' noWrap>
                        {option.mobile ? `(${option.mobile})` : 'No phone'}
                      </Typography>
                    </Box>
                  </Box>
                )}
                renderInput={params => (
                  <TextField
                    {...params}
                    placeholder='Search customers'
                    size='small'
                    autoFocus
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position='start'>
                          <i className='ri-search-line' />
                        </InputAdornment>
                      )
                    }}
                    sx={{
                      minWidth: { xs: 200, sm: 260 },
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 999,
                        backgroundColor: 'background.paper'
                      }
                    }}
                  />
                )}
              />
            </Box>
          </Collapse>
          <Tooltip title={searchOpen ? 'Close search' : 'Search customer'} arrow>
            <IconButton
              color='primary'
              size='small'
              aria-label='Search customer'
              onClick={() =>
                setSearchOpen(prev => {
                  if (prev) {
                    setCustomerInputValue('')
                    setCustomerQuery('')
                    setCustomerOptions([])
                  }

                  return !prev
                })
              }
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: 'var(--mui-customShadows-sm, 0px 4px 14px rgba(0,0,0,0.10))'
              }}
            >
              <i className={searchOpen ? 'ri-close-line' : 'ri-search-line'} />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: { xs: searchOpen ? 'none' : 'flex', sm: 'flex' }, alignItems: 'center', gap: 2 }}>
          <ModeDropdown />
          <Tooltip title='Add customer' arrow>
            <IconButton
              component={Link}
              href='/customers/create'
              color='primary'
              size='small'
              aria-label='Add customer'
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: 'var(--mui-customShadows-sm, 0px 4px 14px rgba(0,0,0,0.10))'
              }}
            >
              <i className='ri-user-add-line' />
            </IconButton>
          </Tooltip>
          <Tooltip title='Create lead' arrow>
            <IconButton
              component={Link}
              href='/loan-cases/create'
              color='primary'
              size='small'
              aria-label='Create lead'
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                boxShadow: 'var(--mui-customShadows-sm, 0px 4px 14px rgba(0,0,0,0.10))'
              }}
            >
              <i className='ri-lightbulb-flash-line' />
            </IconButton>
          </Tooltip>
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
        </Box>
      </div>
    </div>
  )
}

export default NavbarContent
