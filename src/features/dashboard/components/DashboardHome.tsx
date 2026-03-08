'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import SnackbarContent from '@mui/material/SnackbarContent'
import IconButton from '@mui/material/IconButton'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import { useSession } from 'next-auth/react'

import { getLoanCases } from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { getReminders } from '@features/reminders/services/remindersService'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import { listAppointments } from '@features/appointments/services/appointments'
import type { AppointmentListItem } from '@features/appointments/services/appointments'

const DONUT_SIZE = 64

const formatINR = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0

    return `₹ ${safe.toLocaleString('en-IN')}`
}

const Donut = ({
    value,
    total,
    color,
    axisLabel,
    label
}: {
    value: number
    total: number
    color: string
    axisLabel?: string
    label?: string
}) => {
    const safeTotal = Math.max(1, total)
    const pct = Math.max(0, Math.min(1, value / safeTotal))
    const r = 26
    const c = 2 * Math.PI * r
    const dash = c * pct
    const [pinned, setPinned] = useState(false)
    const [hovered, setHovered] = useState(false)
    const showDetail = Boolean(label) && (hovered || pinned)

    return (
        <svg
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            viewBox='0 0 64 64'
            aria-hidden={axisLabel ? undefined : 'true'}
            aria-label={axisLabel}
            role={label ? 'button' : axisLabel ? 'img' : undefined}
            tabIndex={label ? 0 : undefined}
            onMouseEnter={label ? () => setHovered(true) : undefined}
            onMouseLeave={label ? () => setHovered(false) : undefined}
            onFocus={label ? () => setHovered(true) : undefined}
            onBlur={label ? () => setHovered(false) : undefined}
            onClick={label ? () => setPinned(prev => !prev) : undefined}
        >
            {axisLabel ? <title>{axisLabel}</title> : null}
            <circle cx='32' cy='32' r={r} fill='none' stroke='rgb(var(--mui-palette-dividerChannel) / 0.2)' strokeWidth='8' />
            <circle
                cx='32'
                cy='32'
                r={r}
                fill='none'
                stroke={color}
                strokeWidth='8'
                strokeDasharray={`${dash} ${c - dash}`}
                strokeLinecap='round'
                transform='rotate(-90 32 32)'
            />
            {showDetail ? (
                <>
                    <text x='32' y='30' textAnchor='middle' fontSize='12' fontWeight='700' fill='var(--mui-palette-text-primary)'>
                        {Math.round(pct * 100)}%
                    </text>
                    <text x='32' y='42' textAnchor='middle' fontSize='9' fill='var(--mui-palette-text-secondary)'>
                        {label}
                    </text>
                </>
            ) : (
                <text x='32' y='36' textAnchor='middle' fontSize='12' fontWeight='700' fill='var(--mui-palette-text-primary)'>
                    {Math.round(pct * 100)}%
                </text>
            )}
        </svg>
    )
}

const DashboardHome = () => {
    const { data: session } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
    const sessionUserId = String((session as any)?.userId || '')
    const [hasMembership, setHasMembership] = useState(false)
    const [checking, setChecking] = useState(true)
    const [welcomeOpen, setWelcomeOpen] = useState(false)
    const [welcomeName, setWelcomeName] = useState<string | undefined>(undefined)
    const [tenantName, setTenantName] = useState<string | undefined>(undefined)
    const [currentTenantId, setCurrentTenantId] = useState<string | undefined>(undefined)
    const [myLeads, setMyLeads] = useState<LoanCaseListItem[]>([])
    const [myLeadsLoading, setMyLeadsLoading] = useState(false)
    const [remindersNextTwoWeeks, setRemindersNextTwoWeeks] = useState(0)
    const [remindersTotal, setRemindersTotal] = useState(0)
    const [remindersLoading, setRemindersLoading] = useState(false)
    const [remindersError, setRemindersError] = useState<string | null>(null)
    const [stages, setStages] = useState<Array<{ id: string; name: string; order: number }>>([])
    const [stagesLoading, setStagesLoading] = useState(false)
    const [stagesError, setStagesError] = useState<string | null>(null)
    const [meetings, setMeetings] = useState<AppointmentListItem[]>([])
    const [meetingsLoading, setMeetingsLoading] = useState(false)
    const [meetingsError, setMeetingsError] = useState<string | null>(null)

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

                    const currentTenantIdValue =
                        typeof bData?.currentTenant?.id === 'string' && bData.currentTenant.id.length > 0
                            ? bData.currentTenant.id
                            : undefined

                    const tn: string | undefined =
                        typeof bData?.currentTenant?.name === 'string' && bData.currentTenant.name.length > 0
                            ? bData.currentTenant.name
                            : undefined

                    if (active) {
                        setHasMembership(mCount > 0 || uCount > 0 || hasCurrentTenant)
                        if (tn) setTenantName(tn)
                        if (currentTenantIdValue) setCurrentTenantId(currentTenantIdValue)
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

                    const tenantIdValue =
                        typeof s?.currentTenantId === 'string' && s.currentTenantId.length > 0 ? s.currentTenantId : undefined

                    if (active && tn) setTenantName(tn)
                    if (active && tenantIdValue) setCurrentTenantId(tenantIdValue)
                } catch { }
            })()

        return () => {
            active = false
        }
    }, [])


    useEffect(() => {
        const w = searchParams.get('welcome')

        if (w && !welcomeOpen) {
            const loadWelcome = async () => {
                try {
                    const s = await fetch('/api/session/tenant', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}))

                    if (typeof s?.tenantName === 'string' && s.tenantName.length > 0) setWelcomeName(s.tenantName)
                } catch { }

                setWelcomeOpen(true)

                try {
                    router.replace('/home')
                } catch { }
            }

            void loadWelcome()
        }
    }, [searchParams, router, welcomeOpen])

    useEffect(() => {
        let active = true

        if (!currentTenantId || !sessionUserId) {
            setMyLeads([])
            setMyLeadsLoading(false)

            return () => {
                active = false
            }
        }

        const loadLeads = async () => {
            setMyLeadsLoading(true)

            try {
                const items = await getLoanCases({ assignedAgentId: sessionUserId })

                if (active) setMyLeads(items)
            } finally {
                if (active) setMyLeadsLoading(false)
            }
        }

        void loadLeads()

        return () => {
            active = false
        }
    }, [currentTenantId, sessionUserId])

    useEffect(() => {
        let active = true

        if (!currentTenantId) {
            setRemindersNextTwoWeeks(0)
            setRemindersLoading(false)
            setRemindersError(null)

            return () => {
                active = false
            }
        }

        const loadReminders = async () => {
            setRemindersLoading(true)
            setRemindersError(null)

            try {
                const items = await getReminders({ status: 'pending', limit: 50 })
                const now = new Date()
                const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
                const endOfTwoWeeks = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000 - 1)

                let nextTwoWeeksCount = 0

                items.forEach(r => {
                    const dt = new Date(r.reminderDateTime)
                    const time = dt.getTime()

                    if (!Number.isFinite(time)) return

                    if (dt >= start && dt <= endOfTwoWeeks) nextTwoWeeksCount += 1
                })

                if (active) setRemindersNextTwoWeeks(nextTwoWeeksCount)
                if (active) setRemindersTotal(items.length)
            } catch (e: any) {
                if (active) setRemindersError(e?.message || 'Failed to load reminders')
            } finally {
                if (active) setRemindersLoading(false)
            }
        }

        void loadReminders()

        return () => {
            active = false
        }
    }, [currentTenantId])

    useEffect(() => {
        let active = true

        if (!currentTenantId || !sessionUserId) {
            setMeetings([])
            setMeetingsLoading(false)
            setMeetingsError(null)

            return () => {
                active = false
            }
        }

        const loadMeetings = async () => {
            setMeetingsLoading(true)
            setMeetingsError(null)

            try {
                const now = new Date()
                const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
                const items = await listAppointments({ organizerId: sessionUserId, dateFrom: now, dateTo: end })

                const upcoming = items
                    .filter(a => {
                        if (!a.scheduledAt) return false
                        const dt = new Date(a.scheduledAt)

                        return Number.isFinite(dt.getTime()) && dt.getTime() >= now.getTime()
                    })
                    .sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')))
                    .slice(0, 6)

                if (active) setMeetings(upcoming)
            } catch (e: any) {
                if (active) setMeetingsError(e?.message || 'Failed to load meetings')
            } finally {
                if (active) setMeetingsLoading(false)
            }
        }

        void loadMeetings()

        return () => {
            active = false
        }
    }, [currentTenantId, sessionUserId])

    useEffect(() => {
        let active = true

        if (!currentTenantId) {
            setStages([])
            setStagesLoading(false)
            setStagesError(null)

            return () => {
                active = false
            }
        }

        const loadStages = async () => {
            setStagesLoading(true)
            setStagesError(null)

            try {
                const raw = await getLoanStatusPipelineStages()

                const parsed = (Array.isArray(raw) ? raw : [])
                    .map((s: any) => ({
                        id: String(s?.id || ''),
                        name: String(s?.name || ''),
                        order: Number(s?.order || 0)
                    }))
                    .filter(s => s.id.length > 0 && s.name.length > 0)

                if (active) setStages(parsed)
            } catch (e: any) {
                if (active) setStagesError(e?.message || 'Failed to load stages')
            } finally {
                if (active) setStagesLoading(false)
            }
        }

        void loadStages()

        return () => {
            active = false
        }
    }, [currentTenantId])

    const showWelcomeCta = !isSuperAdmin && !hasMembership && !checking
    const hasTenant = Boolean(currentTenantId)

    const disbursementStageIds = useMemo(() => {
        const ids = new Set<string>()

        stages.forEach(s => {
            if (/disburs/i.test(s.name)) ids.add(s.id)
        })

        return ids
    }, [stages])

    const finalStageId = useMemo(() => {
        const finalStage = stages.reduce<{ id: string; name: string; order: number } | null>((max, s) => {
            if (!max) return s
            if ((s.order || 0) > (max.order || 0)) return s

            return max
        }, null)

        return finalStage?.id || null
    }, [stages])

    const widgetMetrics = useMemo(() => {
        const totalLeads = myLeads.length
        const disbursements = Array.from(myLeads).filter(c => disbursementStageIds.has(c.stageId)).length
        const activeCases = finalStageId ? myLeads.filter(c => c.stageId !== finalStageId).length : totalLeads

        return { totalLeads, activeCases, disbursements }
    }, [myLeads, disbursementStageIds, finalStageId])

    const activeCases = useMemo(() => {
        if (!finalStageId) return myLeads

        return myLeads.filter(c => c.stageId !== finalStageId)
    }, [myLeads, finalStageId])

    const activeCasesValue = useMemo(() => {
        return activeCases.reduce((acc, c) => (typeof c.requestedAmount === 'number' ? acc + c.requestedAmount : acc), 0)
    }, [activeCases])

    const closedCases = useMemo(() => {
        if (!finalStageId) return []

        return myLeads.filter(c => c.stageId === finalStageId)
    }, [myLeads, finalStageId])

    const closedCasesValue = useMemo(() => {
        return closedCases.reduce((acc, c) => (typeof c.requestedAmount === 'number' ? acc + c.requestedAmount : acc), 0)
    }, [closedCases])

    const activeCustomersCount = useMemo(() => {
        const ids = new Set<string>()

        activeCases.forEach(c => {
            if (c.customerId) ids.add(c.customerId)
        })

        return ids.size
    }, [activeCases])

    const activeStageSummary = useMemo(() => {
        if (activeCases.length === 0) return []

        const byId = new Map<
            string,
            {
                stageId: string
                stageName: string
                count: number
                totalValue: number
            }
        >()

        activeCases.forEach(c => {
            const stageId = c.stageId || 'unknown'
            const stageName = stages.find(s => s.id === stageId)?.name || c.stageName || 'Stage'
            const prev = byId.get(stageId) || { stageId, stageName, count: 0, totalValue: 0 }

            byId.set(stageId, {
                stageId,
                stageName,
                count: prev.count + 1,
                totalValue: prev.totalValue + (typeof c.requestedAmount === 'number' ? c.requestedAmount : 0)
            })
        })

        if (stages.length === 0) {
            return Array.from(byId.values())
        }

        const ordered = stages.slice().sort((a, b) => (a.order || 0) - (b.order || 0))

        const orderedRows = ordered.map(s => byId.get(s.id)).filter(Boolean) as Array<{
            stageId: string
            stageName: string
            count: number
            totalValue: number
        }>

        const extraRows = Array.from(byId.values()).filter(r => !stages.some(s => s.id === r.stageId))

        return [...orderedRows, ...extraRows]
    }, [activeCases, stages])

    const meetingTitle = (m: AppointmentListItem) => {
        if (m?.customerName) return m.customerName
        if (m?.leadTitle) return m.leadTitle
        if (m?.followUpType) return `${String(m.followUpType).toLowerCase()} follow-up`

        return 'Meeting'
    }

    const meetingTypeMeta = (m: AppointmentListItem) => {
        const t = String(m?.followUpType || '').toUpperCase()

        if (t === 'CALL') return { label: 'Call', icon: 'ri-phone-line', color: 'rgb(var(--mui-palette-info-mainChannel) / 0.12)', text: 'var(--mui-palette-info-main)' }
        if (t === 'WHATSAPP') return { label: 'WhatsApp', icon: 'ri-whatsapp-line', color: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)', text: 'var(--mui-palette-success-main)' }
        if (t === 'VISIT') return { label: 'Visit', icon: 'ri-map-pin-line', color: 'rgb(var(--mui-palette-warning-mainChannel) / 0.12)', text: 'var(--mui-palette-warning-main)' }
        if (t === 'EMAIL') return { label: 'Email', icon: 'ri-mail-line', color: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)', text: 'var(--mui-palette-primary-main)' }

        return { label: 'Meeting', icon: 'ri-calendar-event-line', color: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.12)', text: 'var(--mui-palette-secondary-main)' }
    }

    const formatMeetingTime = (m: AppointmentListItem) => {
        if (!m?.scheduledAt) return 'To be scheduled'
        const start = new Date(m.scheduledAt)

        if (!Number.isFinite(start.getTime())) return 'To be scheduled'
        const minutes = Number(m.durationMinutes || 30)
        const end = new Date(start.getTime() + Math.max(10, minutes) * 60 * 1000)
        const dateFmt = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' })
        const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' })

        return `${dateFmt.format(start)} | ${timeFmt.format(start)}-${timeFmt.format(end)}`
    }

    const initials = (value: string) => {
        const parts = value.trim().split(/\s+/).filter(Boolean)
        const first = parts[0]?.[0] || ''
        const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''

        return `${first}${last}`.toUpperCase()
    }

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
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                    gap: 2
                }}
            >
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    My follow-ups
                                </Typography>
                                <Typography variant='h5' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (remindersLoading ? '...' : remindersNextTwoWeeks) : '—'}
                                </Typography>
                                <Typography variant='body2' color={remindersError ? 'error' : 'text.secondary'}>
                                    {!hasTenant
                                        ? 'Select an organization to view follow-ups'
                                        : remindersError
                                            ? remindersError
                                            : 'In next 2 weeks'}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25 }}>
                                <Donut
                                    value={remindersNextTwoWeeks}
                                    total={remindersTotal}
                                    color='var(--mui-palette-warning-main)'
                                    axisLabel='Share of pending follow-ups scheduled in the next 2 weeks'
                                    label='Pending'
                                />
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <Box>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    Active customers
                                </Typography>
                                <Typography variant='h5' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : activeCustomersCount.toLocaleString()) : '—'}
                                </Typography>
                            </Box>
                            <Avatar
                                sx={{
                                    width: 42,
                                    height: 42,
                                    bgcolor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                                    color: 'var(--mui-palette-primary-main)'
                                }}
                            >
                                <i className='ri-user-3-line' />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <Box>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    Active loan value
                                </Typography>
                                <Typography variant='h5' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : formatINR(activeCasesValue)) : '—'}
                                </Typography>
                            </Box>
                            <Avatar
                                sx={{
                                    width: 42,
                                    height: 42,
                                    bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)',
                                    color: 'var(--mui-palette-success-main)'
                                }}
                            >
                                <i className='ri-hand-coin-line' />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <Box>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    Closed loan value
                                </Typography>
                                <Typography variant='h5' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : formatINR(closedCasesValue)) : '—'}
                                </Typography>
                            </Box>
                            <Avatar
                                sx={{
                                    width: 42,
                                    height: 42,
                                    bgcolor: 'rgb(var(--mui-palette-info-mainChannel) / 0.12)',
                                    color: 'var(--mui-palette-info-main)'
                                }}
                            >
                                <i className='ri-checkbox-circle-line' />
                            </Avatar>
                        </Box>
                    </CardContent>
                </Card>
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr', lg: '2fr 1fr' }, gap: 2 }}>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box>
                                <Typography variant='h6'>Meeting Schedule</Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    Upcoming meetings for the next two weeks
                                </Typography>
                            </Box>
                            <IconButton size='small' aria-label='more'>
                                <i className='ri-more-2-fill' />
                            </IconButton>
                        </Box>
                        {meetingsLoading ? (
                            <Typography variant='body2' color='text.secondary'>
                                Loading meetings…
                            </Typography>
                        ) : meetingsError ? (
                            <Typography variant='body2' color='error'>
                                {meetingsError}
                            </Typography>
                        ) : !hasTenant ? (
                            <Typography variant='body2' color='text.secondary'>
                                Select an organization to view your schedule.
                            </Typography>
                        ) : meetings.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No upcoming meetings yet.
                            </Typography>
                        ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                {meetings.map(m => {
                                    const title = meetingTitle(m)
                                    const tag = meetingTypeMeta(m)
                                    const label = m.customerName || m.leadTitle || 'Meeting'

                                    return (
                                        <Box key={m.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                            <Avatar
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    bgcolor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                                                    color: 'var(--mui-palette-primary-main)'
                                                }}
                                            >
                                                {initials(label)}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexWrap: 'wrap' }}>
                                                    <Typography variant='subtitle2' sx={{ fontWeight: 700 }} noWrap>
                                                        {title}
                                                    </Typography>
                                                    {m?.customerIsNRI ? (
                                                        <Chip
                                                            label='NRI'
                                                            size='small'
                                                            variant='outlined'
                                                            icon={<i className='ri-global-line' />}
                                                            sx={{
                                                                height: 24,
                                                                boxShadow: 'none',
                                                                borderColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.5)',
                                                                color: 'warning.main',
                                                                backgroundColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)'
                                                            }}
                                                        />
                                                    ) : null}
                                                </Box>
                                                <Typography variant='caption' color='text.secondary' noWrap>
                                                    <i className='ri-calendar-event-line' style={{ marginRight: 6 }} />
                                                    {formatMeetingTime(m)}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.75,
                                                    px: 1.25,
                                                    py: 0.5,
                                                    borderRadius: 10,
                                                    backgroundColor: tag.color,
                                                    color: tag.text,
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                <i className={tag.icon} />
                                                <Box component='span' sx={{ display: { xs: 'none', sm: 'inline' } }}>
                                                    {tag.label}
                                                </Box>
                                            </Box>
                                        </Box>
                                    )
                                })}
                            </Box>
                        )}
                    </CardContent>
                </Card>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: 0.5 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    My active cases
                                </Typography>
                                <Typography variant='h5' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : widgetMetrics.activeCases) : '—'}
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                                <Typography variant='body2' color='text.secondary'>
                                    Total value
                                </Typography>
                                <Typography variant='subtitle1' sx={{ fontWeight: 700 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : formatINR(activeCasesValue)) : '—'}
                                </Typography>
                            </Box>
                        </Box>
                        <Typography variant='body2' color={stagesError ? 'error' : 'text.secondary'}>
                            {!hasTenant
                                ? 'Select an organization to view cases'
                                : stagesError
                                    ? stagesError
                                    : stagesLoading
                                        ? 'Loading stages'
                                        : 'Stage-wise breakdown'}
                        </Typography>
                        {!hasTenant ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                Choose an organization to load active cases by stage.
                            </Typography>
                        ) : myLeadsLoading || stagesLoading ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                Loading stage breakdown...
                            </Typography>
                        ) : stagesError ? (
                            <Typography variant='body2' color='error' sx={{ mt: 1 }}>
                                {stagesError}
                            </Typography>
                        ) : activeStageSummary.length === 0 ? (
                            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                No active cases.
                            </Typography>
                        ) : (
                            <TableContainer
                                sx={{
                                    mt: 1.25,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    maxHeight: 240
                                }}
                            >
                                <Table size='small' stickyHeader>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Stage</TableCell>
                                            <TableCell align='right'>Cases</TableCell>
                                            <TableCell align='right'>Total Value</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {activeStageSummary.map(stage => (
                                            <TableRow key={`${stage.stageId}-${stage.stageName}`}>
                                                <TableCell>{stage.stageName}</TableCell>
                                                <TableCell align='right'>{stage.count}</TableCell>
                                                <TableCell align='right'>{formatINR(stage.totalValue)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </CardContent>
                </Card>
            </Box>
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
