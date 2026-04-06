'use client'

import { useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'

import { useRouter } from 'next/navigation'

import { signOut, useSession } from 'next-auth/react'
import { styled } from '@mui/material/styles'
import Badge from '@mui/material/Badge'
import Avatar from '@mui/material/Avatar'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import MenuItem from '@mui/material/MenuItem'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

import { useSettings } from '@core/hooks/useSettings'
import { SwitchOrganisationDialog } from '@features/tenants/components/SwitchOrganisationDialog'

// Styled component for badge content
const BadgeContentSpan = styled('span')({
  width: 8,
  height: 8,
  borderRadius: '50%',
  cursor: 'pointer',
  backgroundColor: 'var(--mui-palette-success-main)',
  boxShadow: '0 0 0 2px var(--mui-palette-background-paper)'
})

type UserInfo = {
  name?: string | null
  email?: string | null
  image?: string | null
}

type TenantInfo = {
  tenantName?: string
  role?: 'OWNER' | 'ADMIN' | 'USER'
}

type ImpersonationUser = {
  id: string
  name: string
  email?: string | null
  isSuperAdmin?: boolean
}

const roleLabel = (role?: TenantInfo['role']) => {
  if (role === 'OWNER') return 'Owner'
  if (role === 'ADMIN') return 'Admin'
  if (role === 'USER') return 'User'

  return 'Member'
}

const UserDropdown = ({
  user,
  tenant,
  isSuperAdmin
}: {
  user?: UserInfo
  tenant?: TenantInfo
  isSuperAdmin?: boolean
}) => {
  // States
  const [open, setOpen] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [canSwitch, setCanSwitch] = useState(false)
  const [switchOpen, setSwitchOpen] = useState(false)
  const [resolvedTenant, setResolvedTenant] = useState<TenantInfo | undefined>(tenant)
  const [impersonateOpen, setImpersonateOpen] = useState(false)
  const [impersonatingBusy, setImpersonatingBusy] = useState(false)
  const [impersonationError, setImpersonationError] = useState<string | null>(null)
  const [impersonationUsers, setImpersonationUsers] = useState<ImpersonationUser[]>([])
  const [impersonationUsersLoading, setImpersonationUsersLoading] = useState(false)
  const [impersonationQuery, setImpersonationQuery] = useState('')
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('')
  const [impersonationReason, setImpersonationReason] = useState('')

  // Refs
  const anchorRef = useRef<HTMLDivElement>(null)

  // Hooks
  const router = useRouter()
  const { data: session, update } = useSession()

  const { settings } = useSettings()
  const activeImpersonation = (session as any)?.impersonation
  const isImpersonating = Boolean(activeImpersonation?.active)
  const canImpersonate = Boolean(isSuperAdmin) && !isImpersonating

  const handleDropdownOpen = () => {
    const next = !open

    setOpen(next)

    if (next && !resolvedTenant) {
      ;

      (async () => {
        try {
          const bRes = await fetch('/api/session/bootstrap', { cache: 'no-store' })
          const b = await bRes.json().catch(() => ({}))
          const ct = b?.currentTenant

          if (ct?.id && (ct?.name || ct?.role)) {
            setResolvedTenant({ tenantName: ct?.name, role: ct?.role })

            return
          }

          const sRes = await fetch('/api/session/tenant', { cache: 'no-store' })
          const s = await sRes.json().catch(() => ({}))
          const currentId: string | undefined = s?.currentTenantId
          const role: 'OWNER' | 'ADMIN' | 'USER' | undefined = s?.role
          const name: string | undefined = s?.tenantName

          if (currentId && (role || name)) {
            setResolvedTenant({ tenantName: name, role })

            return
          }

          const tRes = await fetch('/api/tenants/by-user', { cache: 'no-store' })
          const t = await tRes.json().catch(() => ({}))
          const items: Array<{ _id: string; name: string; role: 'OWNER' | 'ADMIN' | 'USER' }> = t?.tenants || []

          if (currentId) {
            const m = items.find(i => i._id === currentId)

            if (m) {
              setResolvedTenant({ tenantName: m.name, role: m.role })

              return
            }
          }

          if (items.length === 1) {
            setResolvedTenant({ tenantName: items[0]?.name, role: items[0]?.role })
          }
        } catch { }
      })()
    }
  }

  const handleDropdownClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent), url?: string) => {
    if (url) {
      router.push(url)
    }

    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const handleUserLogout = async () => {
    setLoggingOut(true)

    try {
      await signOut({ callbackUrl: '/login' })
    } finally {
      setLoggingOut(false)
    }
  }

  const loadImpersonationUsers = async (query?: string) => {
    setImpersonationUsersLoading(true)
    setImpersonationError(null)

    try {
      const q = encodeURIComponent(String(query || '').trim())
      const res = await fetch(`/api/super-admin/impersonation/users${q ? `?q=${q}` : ''}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setImpersonationError('Unable to load users')
        setImpersonationUsers([])

        return
      }

      const items: ImpersonationUser[] = Array.isArray(data?.users) ? data.users : []
      const filtered = items.filter(u => !u?.isSuperAdmin)

      setImpersonationUsers(filtered)
      setSelectedTargetUserId(filtered[0]?.id || '')
    } catch {
      setImpersonationError('Unable to load users')
      setImpersonationUsers([])
    } finally {
      setImpersonationUsersLoading(false)
    }
  }

  const openImpersonationDialog = async () => {
    setOpen(false)
    setImpersonateOpen(true)
    await loadImpersonationUsers(impersonationQuery)
  }

  const startImpersonation = async () => {
    if (!selectedTargetUserId) return
    setImpersonatingBusy(true)
    setImpersonationError(null)

    try {
      const res = await fetch('/api/super-admin/impersonation/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedTargetUserId,
          reason: impersonationReason.trim() || undefined
        })
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.nonce) {
        setImpersonationError('Unable to start impersonation')

        return
      }

      await update({ impersonationStartNonce: data.nonce } as any)
      setImpersonateOpen(false)
      router.push('/post-login')
      router.refresh()
    } catch {
      setImpersonationError('Unable to start impersonation')
    } finally {
      setImpersonatingBusy(false)
    }
  }

  const stopImpersonation = async () => {
    setImpersonatingBusy(true)
    setImpersonationError(null)

    try {
      const res = await fetch('/api/super-admin/impersonation/stop', {
        method: 'POST'
      })

      if (!res.ok) {
        setImpersonationError('Unable to return to super admin')

        return
      }

      await update({ impersonationStop: true } as any)
      setOpen(false)
      router.push('/post-login')
      router.refresh()
    } catch {
      setImpersonationError('Unable to return to super admin')
    } finally {
      setImpersonatingBusy(false)
    }
  }

  useEffect(() => {
    const checkCount = async () => {
      try {
        const res = await fetch('/api/memberships/by-user', { cache: 'no-store' })
        const data = await res.json()

        if (res.ok && Number(data?.count || 0) > 1) setCanSwitch(true)
      } catch {
        // ignore
      }
    }

    checkCount()
  }, [])

  useEffect(() => {
    if (tenant?.tenantName || tenant?.role) {
      setResolvedTenant(tenant)

      return
    }

    const resolve = async () => {
      try {
        const sRes = await fetch('/api/session/tenant', { cache: 'no-store' })
        const s = await sRes.json().catch(() => ({}))
        const currentId: string | undefined = s?.currentTenantId
        const role: 'OWNER' | 'ADMIN' | 'USER' | undefined = s?.role
        const name: string | undefined = s?.tenantName

        if (currentId && (role || name)) {
          setResolvedTenant({ tenantName: name, role })

          return
        }

        const tRes = await fetch('/api/tenants/by-user', { cache: 'no-store' })
        const t = await tRes.json().catch(() => ({}))
        const items: Array<{ _id: string; name: string; role: 'OWNER' | 'ADMIN' | 'USER' }> = t?.tenants || []

        if (currentId) {
          const m = items.find(i => i._id === currentId)

          if (m) {
            setResolvedTenant({ tenantName: m.name, role: m.role })

            return
          }
        }

        if (items.length === 1) {
          setResolvedTenant({ tenantName: items[0]?.name, role: items[0]?.role })
        }
      } catch {
        // ignore
      }
    }

    resolve()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.tenantName, tenant?.role])

  const openSwitchDialog = () => {
    setOpen(false)
    setSwitchOpen(true)
  }

  return (
    <>
      <Badge
        ref={anchorRef}
        overlap='circular'
        badgeContent={<BadgeContentSpan onClick={handleDropdownOpen} />}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        className='mis-2'
      >
        <Avatar
          ref={anchorRef}
          alt={user?.name ?? 'User'}
          src={user?.image ?? '/images/avatars/1.png'}
          onClick={handleDropdownOpen}
          className='cursor-pointer bs-[38px] is-[38px]'
        />
      </Badge>
      <Popper
        open={open}
        transition
        disablePortal
        placement='bottom-end'
        anchorEl={anchorRef.current}
        className='min-is-[240px] !mbs-4 z-[1]'
      >
        {({ TransitionProps, placement }) => (
          <Fade
            {...TransitionProps}
            style={{
              transformOrigin: placement === 'bottom-end' ? 'right top' : 'left top'
            }}
          >
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleDropdownClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-4 gap-2' tabIndex={-1}>
                    <Avatar alt={user?.name ?? 'User'} src={user?.image ?? '/images/avatars/1.png'} />
                    <div className='flex items-start flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {user?.name ?? '—'}
                      </Typography>
                      <Typography variant='caption'>{user?.email ?? '—'}</Typography>
                    </div>
                  </div>
                  <Divider className='mlb-1' />
                  {(isSuperAdmin || resolvedTenant) &&
                    [
                      <div key='org-info' className='flex flex-col gap-1 pli-4 plb-2' tabIndex={-1}>
                        <Typography color='text.primary'>{resolvedTenant?.tenantName ?? '—'}</Typography>
                        <Typography variant='caption' color='text.secondary'>
                          Role: {isSuperAdmin ? 'Super Admin' : roleLabel(resolvedTenant?.role)}
                        </Typography>
                      </div>,
                      <Divider key='org-divider' className='mlb-1' />
                    ]}
                  <MenuItem className='gap-3' onClick={e => handleDropdownClose(e, '/create-tenant')}>
                    <i className='ri-building-2-line' />
                    <Typography color='text.primary'>Create Organisation</Typography>
                  </MenuItem>
                  {canSwitch && (
                    <MenuItem className='gap-3' onClick={() => openSwitchDialog()}>
                      <i className='ri-exchange-line' />
                      <Typography color='text.primary'>Switch Organisation</Typography>
                    </MenuItem>
                  )}
                  {canImpersonate && (
                    <MenuItem className='gap-3' onClick={() => openImpersonationDialog()}>
                      <i className='ri-user-search-line' />
                      <Typography color='text.primary'>Login as User</Typography>
                    </MenuItem>
                  )}
                  {isImpersonating && (
                    <MenuItem className='gap-3' onClick={() => stopImpersonation()}>
                      <i className='ri-shield-user-line' />
                      <Typography color='text.primary'>Return to Super Admin</Typography>
                    </MenuItem>
                  )}
                  <MenuItem className='gap-3' onClick={e => handleDropdownClose(e, '/profile')}>
                    <i className='ri-user-3-line' />
                    <Typography color='text.primary'>My Profile</Typography>
                  </MenuItem>
                  <div className='flex items-center plb-2 pli-4'>
                    <Button
                      fullWidth
                      variant='contained'
                      color='error'
                      size='small'
                      endIcon={<i className='ri-logout-box-r-line' />}
                      onClick={handleUserLogout}
                      sx={{ '& .MuiButton-endIcon': { marginInlineStart: 1.5 } }}
                    >
                      {loggingOut ? 'Logging out…' : 'Logout'}
                    </Button>
                  </div>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
      <SwitchOrganisationDialog open={switchOpen} onClose={() => setSwitchOpen(false)} />
      <Dialog open={impersonateOpen} onClose={() => setImpersonateOpen(false)} fullWidth maxWidth='sm'>
        <DialogTitle>Login as User</DialogTitle>
        <DialogContent>
          <Box className='flex flex-col gap-4 pt-2'>
            <Box className='flex gap-2 items-center'>
              <TextField
                fullWidth
                size='small'
                label='Search user'
                value={impersonationQuery}
                onChange={e => setImpersonationQuery(e.target.value)}
              />
              <Button
                variant='outlined'
                onClick={() => loadImpersonationUsers(impersonationQuery)}
                disabled={impersonationUsersLoading || impersonatingBusy}
              >
                Search
              </Button>
            </Box>
            <TextField
              select
              fullWidth
              size='small'
              label='Select user'
              value={selectedTargetUserId}
              onChange={e => setSelectedTargetUserId(e.target.value)}
              disabled={impersonationUsersLoading || impersonatingBusy}
            >
              {impersonationUsers.map(u => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name || 'Unnamed'} {u.email ? `(${u.email})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              size='small'
              label='Reason (optional)'
              value={impersonationReason}
              onChange={e => setImpersonationReason(e.target.value)}
              disabled={impersonatingBusy}
            />
            {impersonationUsersLoading && (
              <Box className='flex items-center gap-2'>
                <CircularProgress size={16} />
                <Typography variant='body2'>Loading users...</Typography>
              </Box>
            )}
            {impersonationError && (
              <Typography variant='body2' color='error'>
                {impersonationError}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImpersonateOpen(false)} disabled={impersonatingBusy}>
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={() => startImpersonation()}
            disabled={impersonatingBusy || impersonationUsersLoading || !selectedTargetUserId}
          >
            {impersonatingBusy ? 'Starting...' : 'Login as User'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default UserDropdown
