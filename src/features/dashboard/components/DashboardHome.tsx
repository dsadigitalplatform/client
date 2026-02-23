'use client'

import { useEffect, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import SnackbarContent from '@mui/material/SnackbarContent'
import IconButton from '@mui/material/IconButton'
import { useSession } from 'next-auth/react'

const DashboardHome = () => {
    const { data: session } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
    const [hasMembership, setHasMembership] = useState(false)
    const [checking, setChecking] = useState(true)
    const [welcomeOpen, setWelcomeOpen] = useState(false)
    const [welcomeName, setWelcomeName] = useState<string | undefined>(undefined)
    const [tenantName, setTenantName] = useState<string | undefined>(undefined)

    useEffect(() => {
        let active = true

            ; (async () => {
                setChecking(true)

                try {
                    const bRes = await fetch('/api/session/bootstrap', { cache: 'no-store' })
                    const bData: any = await bRes.json().catch(() => ({}))
                    const mCount = Number(bData?.memberships?.count || 0)
                    const hasCurrentTenant = Boolean(bData?.currentTenant?.id)
                    const uCount = Array.isArray(bData?.tenants) ? bData.tenants.length : 0

                    const tn: string | undefined =
                        typeof bData?.currentTenant?.name === 'string' && bData.currentTenant.name.length > 0
                            ? bData.currentTenant.name
                            : undefined

                    if (active) {
                        setHasMembership(mCount > 0 || uCount > 0 || hasCurrentTenant)
                        if (tn) setTenantName(tn)
                    }
                } catch {
                    const tenantIds = ((session as any)?.tenantIds as string[] | undefined) || []

                    if (active) setHasMembership(tenantIds.length > 0)
                } finally {
                    if (active) setChecking(false)
                }
            })()


        return () => {
            active = false
        }
    }, [session])
    useEffect(() => {
        let active = true

            ; (async () => {
                try {
                    const s = await fetch('/api/session/tenant', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))

                    const tn: string | undefined =
                        typeof s?.tenantName === 'string' && s.tenantName.length > 0 ? s.tenantName : undefined

                    if (active && tn) setTenantName(tn)
                } catch { }
            })()

        
return () => {
            active = false
        }
    }, [])


    useEffect(() => {
        const w = searchParams.get('welcome')

        if (w && !welcomeOpen) {
            ;

            (async () => {
                try {
                    const s = await fetch('/api/session/tenant', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))

                    if (typeof s?.tenantName === 'string' && s.tenantName.length > 0) setWelcomeName(s.tenantName)
                } catch { }

                setWelcomeOpen(true)

                try {
                    router.replace('/home')
                } catch { }
            })()
        }
    }, [searchParams, router, welcomeOpen])

    const showWelcomeCta = !isSuperAdmin && !hasMembership && !checking

    return (
        <Box className='flex flex-col gap-4'>
            <Typography variant='h4'>Dashboard</Typography>
            <Typography color='text.secondary'>
                {tenantName ? `Welcome to ${tenantName}` : 'Welcome to your dashboard.'}
            </Typography>
            {showWelcomeCta && (
                <Box className='mt-4 flex flex-col gap-2'>
                    <Typography variant='h6'>Welcome!</Typography>
                    <Typography color='text.secondary'>
                        Start by creating your organization to unlock your workspace.
                    </Typography>
                    <Button
                        variant='contained'
                        size='large'
                        component={Link}
                        href='/create-tenant'
                        startIcon={<i className='ri-building-2-line' />}
                    >
                        Create Organization
                    </Button>
                </Box>
            )}
        <Snackbar open={welcomeOpen} autoHideDuration={4000} onClose={() => setWelcomeOpen(false)}>
          <SnackbarContent
            sx={{
              backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.7)',
              color: 'text.primary',
              border: '1px solid rgb(var(--mui-palette-success-mainChannel) / 0.3)',
              borderRadius: 2.5,
              boxShadow: '0 12px 30px rgb(0 0 0 / 0.12)',
              backdropFilter: 'blur(12px)',
              px: 2,
              py: 1.5
            }}
            message={
              <Box className='flex items-center gap-3'>
                <Box
                  className='flex items-center justify-center rounded-md'
                  sx={{
                    width: 28,
                    height: 28,
                    backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.85)',
                    color: 'var(--mui-palette-success-main)'
                  }}
                >
                  <i className='ri-checkbox-circle-line text-[18px]' />
                </Box>
                <Box>
                  <span style={{ fontWeight: 600 }}>
                    {welcomeName ? `Welcome to ${welcomeName}` : 'Welcome to your organisation'}
                  </span>
                </Box>
              </Box>
            }
            action={
              <IconButton
                size='small'
                aria-label='close'
                onClick={() => setWelcomeOpen(false)}
                sx={{ color: 'var(--mui-palette-grey-700)' }}
              >
                <i className='ri-close-line' />
              </IconButton>
            }
          />
        </Snackbar>
        </Box>
    )
}

export default DashboardHome
