'use client'

import { useEffect, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
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

                    if (active) setHasMembership((mCount > 0) || (uCount > 0) || hasCurrentTenant)
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
        const w = searchParams.get('welcome')

        if (w && !welcomeOpen) {
            ;

(async () => {
                try {
                    const s = await fetch('/api/session/tenant', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))

                    if (typeof s?.tenantName === 'string' && s.tenantName.length > 0) setWelcomeName(s.tenantName)
                } catch {}

                setWelcomeOpen(true)

                try {
                    router.replace('/home')
                } catch {}
            })()
        }
    }, [searchParams, router, welcomeOpen])

    const showWelcomeCta = !isSuperAdmin && !hasMembership && !checking

    return (
        <Box className='flex flex-col gap-4'>
            <Typography variant='h4'>Dashboard</Typography>
            <Typography color='text.secondary'>Welcome to your dashboard.</Typography>
            {showWelcomeCta && (
                <Box className='mt-4 flex flex-col gap-2'>
                    <Typography variant='h6'>Welcome!</Typography>
                    <Typography color='text.secondary'>Start by creating your organization to unlock your workspace.</Typography>
                    <Button variant='contained' size='large' component={Link} href='/create-tenant' startIcon={<i className='ri-building-2-line' />}>
                        Create Organization
                    </Button>
                </Box>
            )}
            <Snackbar open={welcomeOpen} autoHideDuration={4000} onClose={() => setWelcomeOpen(false)}>
                <Alert severity='success' onClose={() => setWelcomeOpen(false)} sx={{ width: '100%' }}>
                    {welcomeName ? `Welcome to ${welcomeName}` : 'Welcome to your organisation'}
                </Alert>
            </Snackbar>
        </Box>
    )
}

export default DashboardHome
