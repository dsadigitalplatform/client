'use client'

import { useEffect, useMemo, useState } from 'react'

import { useTheme } from '@mui/material/styles'

import { useRouter, useSearchParams } from 'next/navigation'

import Link from 'next/link'
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Snackbar from '@mui/material/Snackbar'
import SnackbarContent from '@mui/material/SnackbarContent'
import IconButton from '@mui/material/IconButton'
import { useSession } from 'next-auth/react'

import { getLoanCases } from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import { getAppointmentById, listAppointments } from '@features/appointments/services/appointments'
import type { AppointmentListItem } from '@features/appointments/services/appointments'
import OrganisationSetupSupportDialog from '@features/support/components/OrganisationSetupSupportDialog'
import { getTenantUsers } from '@features/loan-cases/services/loanCasesService'
import type { TenantUserOption } from '@features/loan-cases/loan-cases.types'
import DashboardHero from '@features/dashboard/components/DashboardHero'
import {
    filterByDashboardPeriod,
    formatDashboardPeriodLabel,
    DASHBOARD_PERIOD_DEFAULT_MONTHS,
    type DashboardTimePeriod
} from '@features/dashboard/utils/timelineBuckets'
import DashboardStatCard from '@features/dashboard/components/DashboardStatCard'
import DisbursementInsightsSection from '@features/dashboard/components/DisbursementInsightsSection'
import BreakdownApexChart, { type BreakdownPoint } from '@features/dashboard/components/BreakdownApexChart'
import {
    BreakdownChartControls,
    type BreakdownChartType,
    type BreakdownMetric,
    type BreakdownSortOrder,
    type TopLimit
} from '@features/dashboard/components/DashboardChartToolbar'
import DashboardAnalyticsSection from '@features/dashboard/components/DashboardAnalyticsSection'
import MonthlyPerformanceSection from '@features/dashboard/components/MonthlyPerformanceSection'
import { useMonthlyPerformance } from '@features/dashboard/hooks/useMonthlyPerformance'
import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'
import AgentWorkQueue from '@features/dashboard/components/AgentWorkQueue'
import PipelineStagePulse from '@features/dashboard/components/PipelineStagePulse'
import {
    findCompletedStageIds,
    findRejectedStageIds,
    findTerminalStageIds
} from '@features/loan-status-pipeline/stageFlags'

const formatINR = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0

    return `₹ ${safe.toLocaleString('en-IN')}`
}

const sortPipelineBreakdown = (
    rows: BreakdownPoint[],
    metric: BreakdownMetric,
    top: TopLimit,
    sort: BreakdownSortOrder
) => {
    const key = metric === 'amount' ? 'value' : 'count'
    const sorted =
        sort === 'pipeline'
            ? rows.slice()
            : rows.slice().sort((a, b) => {
                  if (sort === 'name') return a.label.localeCompare(b.label)
                  if (sort === 'asc') return a[key] - b[key]

                  return b[key] - a[key]
              })

    if (top === 0) return sorted

    return sorted.slice(0, top)
}

const DashboardHome = () => {
    const theme = useTheme()
    const { data: session } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
    const sessionUserId = String((session as any)?.userId || '')
    const sessionUserName = String((session as any)?.user?.name || '')
    const [tenantRole, setTenantRole] = useState<'OWNER' | 'ADMIN' | 'USER' | undefined>(undefined)
    const [tenantUsers, setTenantUsers] = useState<TenantUserOption[]>([])
    const [viewingAgentId, setViewingAgentId] = useState('')
    const [hasAgentFilterOverride, setHasAgentFilterOverride] = useState(false)
    const [hasMembership, setHasMembership] = useState(false)
    const [checking, setChecking] = useState(true)
    const [welcomeOpen, setWelcomeOpen] = useState(false)
    const [welcomeName, setWelcomeName] = useState<string | undefined>(undefined)
    const [tenantName, setTenantName] = useState<string | undefined>(undefined)
    const [currentTenantId, setCurrentTenantId] = useState<string | undefined>(undefined)
    const [myLeads, setMyLeads] = useState<LoanCaseListItem[]>([])
    const [myLeadsLoading, setMyLeadsLoading] = useState(false)
    const [stages, setStages] = useState<
        Array<{
            id: string
            name: string
            order: number
            isLoggedIn: boolean
            isDisbursed: boolean
            isClosed: boolean
            isRejected: boolean
        }>
    >([])
    const [stagesLoading, setStagesLoading] = useState(false)
    const [stagesError, setStagesError] = useState<string | null>(null)
    const [meetings, setMeetings] = useState<AppointmentListItem[]>([])
    const [meetingsLoading, setMeetingsLoading] = useState(false)
    const [meetingsError, setMeetingsError] = useState<string | null>(null)
    const [actionToast, setActionToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' })
    const [supportOpen, setSupportOpen] = useState(false)
    const [supportAutoShown, setSupportAutoShown] = useState(false)
    const [pipelineChartType, setPipelineChartType] = useState<BreakdownChartType>('horizontal')
    const [pipelineMetric, setPipelineMetric] = useState<BreakdownMetric>('count')
    const [pipelineTop, setPipelineTop] = useState<TopLimit>(8)
    const [pipelineSort, setPipelineSort] = useState<BreakdownSortOrder>('pipeline')
    const [dashboardPeriod, setDashboardPeriod] = useState<DashboardTimePeriod>({
        mode: 'months',
        months: DASHBOARD_PERIOD_DEFAULT_MONTHS
    })

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

    const isAdminView = tenantRole === 'ADMIN' || tenantRole === 'OWNER'
    const effectiveAssignedAgentId = isAdminView ? viewingAgentId || undefined : sessionUserId
    const isViewingAllAgents = isAdminView && !viewingAgentId

    useEffect(() => {
        void (async () => {
            try {
                const [usersData, tenantRes] = await Promise.all([
                    getTenantUsers(),
                    fetch('/api/session/tenant', { cache: 'no-store' })
                ])
                const tenantData = await tenantRes.json().catch(() => ({}))

                setTenantUsers(Array.isArray(usersData) ? usersData : [])
                setTenantRole(
                    typeof tenantData?.role === 'string' ? (tenantData.role as 'OWNER' | 'ADMIN' | 'USER') : undefined
                )
            } catch {
                // ignore
            }
        })()
    }, [])

    useEffect(() => {
        if (!sessionUserId) return

        if (!isAdminView) {
            if (viewingAgentId === sessionUserId) return
            setViewingAgentId(sessionUserId)

            return
        }

        if (hasAgentFilterOverride) return
        if (viewingAgentId) return

        const sorted = tenantUsers.slice().sort((a, b) => a.name.localeCompare(b.name))

        if (sorted.some(u => u.id === sessionUserId)) {
            setViewingAgentId(sessionUserId)

            return
        }

        if (sorted.length > 0) setViewingAgentId(sorted[0].id)
    }, [hasAgentFilterOverride, isAdminView, sessionUserId, tenantUsers, viewingAgentId])

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
                const items = await getLoanCases(
                    effectiveAssignedAgentId ? { assignedAgentId: effectiveAssignedAgentId } : undefined
                )

                if (active) setMyLeads(items)
            } finally {
                if (active) setMyLeadsLoading(false)
            }
        }

        void loadLeads()

        return () => {
            active = false
        }
    }, [currentTenantId, effectiveAssignedAgentId, sessionUserId])

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
                const from = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000)
                const end = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
                const items = await listAppointments({
                    ...(effectiveAssignedAgentId ? { organizerId: effectiveAssignedAgentId } : {}),
                    dateFrom: from,
                    dateTo: end
                })

                const open = items
                    .filter(a => {
                        const status = String(a?.status || 'PENDING').toUpperCase()

                        if (status !== 'PENDING' && status !== 'SCHEDULED') return false
                        if (!a.scheduledAt) return false
                        const dt = new Date(a.scheduledAt)

                        return Number.isFinite(dt.getTime())
                    })
                    .sort((a, b) => String(a.scheduledAt || '').localeCompare(String(b.scheduledAt || '')))

                if (active) setMeetings(open)
            } catch (e: any) {
                if (active) setMeetingsError(e?.message || 'Failed to load follow-ups')
            } finally {
                if (active) setMeetingsLoading(false)
            }
        }

        void loadMeetings()

        return () => {
            active = false
        }
    }, [currentTenantId, effectiveAssignedAgentId, sessionUserId])

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
                        order: Number(s?.order || 0),
                        isLoggedIn: Boolean(s?.isLoggedIn),
                        isDisbursed: Boolean(s?.isDisbursed),
                        isClosed: Boolean(s?.isClosed),
                        isRejected: Boolean(s?.isRejected)
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

    const showWelcomeCta = isSuperAdmin && !hasMembership && !checking
    const hasTenant = Boolean(currentTenantId)
    const {
        data: monthlyPerformance,
        loading: monthlyPerformanceLoading,
        error: monthlyPerformanceError,
        refresh: refreshMonthlyPerformance
    } = useMonthlyPerformance(hasTenant, effectiveAssignedAgentId)

    useEffect(() => {
        if (checking || isSuperAdmin || hasMembership || supportAutoShown) return

        setSupportOpen(true)
        setSupportAutoShown(true)
    }, [checking, isSuperAdmin, hasMembership, supportAutoShown])

    const disbursementStageIds = useMemo(() => {
        const ids = new Set<string>()
        const flagged = stages.filter(s => s.isDisbursed)

        if (flagged.length > 0) {
            flagged.forEach(s => ids.add(s.id))

            return ids
        }

        stages.forEach(s => {
            if (/disburs/i.test(s.name)) ids.add(s.id)
        })

        return ids
    }, [stages])

    const terminalStageIds = useMemo(() => findTerminalStageIds(stages), [stages])
    const completedStageIds = useMemo(() => findCompletedStageIds(stages), [stages])
    const rejectedStageIds = useMemo(() => new Set(findRejectedStageIds(stages)), [stages])

    const periodFilteredLeads = useMemo(
        () =>
            filterByDashboardPeriod(myLeads, c => (c.updatedAt ? new Date(c.updatedAt) : null), dashboardPeriod),
        [myLeads, dashboardPeriod]
    )

    const dashboardPeriodLabel = useMemo(() => formatDashboardPeriodLabel(dashboardPeriod), [dashboardPeriod])

    const widgetMetrics = useMemo(() => {
        const totalLeads = periodFilteredLeads.length
        const disbursements = Array.from(periodFilteredLeads).filter(c => disbursementStageIds.has(c.stageId)).length
        const activeCases = terminalStageIds.size
            ? periodFilteredLeads.filter(c => !terminalStageIds.has(c.stageId)).length
            : totalLeads

        return { totalLeads, activeCases, disbursements }
    }, [periodFilteredLeads, disbursementStageIds, terminalStageIds])

    const activeCases = useMemo(() => {
        if (terminalStageIds.size === 0) return periodFilteredLeads

        return periodFilteredLeads.filter(c => !terminalStageIds.has(c.stageId))
    }, [periodFilteredLeads, terminalStageIds])

    const activeCasesValue = useMemo(() => {
        return activeCases.reduce((acc, c) => acc + (resolveApprovedAmount(c) ?? 0), 0)
    }, [activeCases])

    const closedCases = useMemo(() => {
        if (completedStageIds.size === 0) return []

        return periodFilteredLeads.filter(c => completedStageIds.has(c.stageId))
    }, [periodFilteredLeads, completedStageIds])

    const closedCasesValue = useMemo(() => {
        return closedCases.reduce((acc, c) => acc + (resolveApprovedAmount(c) ?? 0), 0)
    }, [closedCases])

    const rejectedCases = useMemo(() => {
        if (rejectedStageIds.size === 0) return []

        return periodFilteredLeads.filter(c => rejectedStageIds.has(c.stageId))
    }, [periodFilteredLeads, rejectedStageIds])

    const activeCustomersCount = useMemo(() => {
        const ids = new Set<string>()

        activeCases.forEach(c => {
            if (c.customerId) ids.add(c.customerId)
        })

        return ids.size
    }, [activeCases])

    const progressiveLeadsCount = useMemo(
        () => periodFilteredLeads.filter(c => Boolean(c.enableProgressivePayment)).length,
        [periodFilteredLeads]
    )

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
                totalValue: prev.totalValue + (resolveApprovedAmount(c) ?? 0)
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

    const pipelineBreakdownRows = useMemo<BreakdownPoint[]>(
        () =>
            activeStageSummary.map(s => ({
                label: s.stageName,
                value: s.totalValue,
                count: s.count
            })),
        [activeStageSummary]
    )

    const pipelineDisplay = useMemo(
        () => sortPipelineBreakdown(pipelineBreakdownRows, pipelineMetric, pipelineTop, pipelineSort),
        [pipelineBreakdownRows, pipelineMetric, pipelineTop, pipelineSort]
    )

    const liveActiveCases = useMemo(() => {
        if (terminalStageIds.size === 0) return myLeads

        return myLeads.filter(c => !terminalStageIds.has(c.stageId))
    }, [myLeads, terminalStageIds])

    const pipelineLeadingStage = pipelineDisplay[0]

    const normalizeDigits = (value: string | null | undefined) => String(value || '').replace(/\D/g, '')

    const buildContactNumber = (countryCode?: string | null, mobile?: string | null) => {
        const code = normalizeDigits(countryCode)
        const phone = normalizeDigits(mobile)

        if (!phone) return ''

        return code ? `${code}${phone}` : phone
    }

    const openFollowUpContact = async (meeting: AppointmentListItem) => {
        const type = String(meeting?.followUpType || '').toUpperCase()

        if (type !== 'CALL' && type !== 'WHATSAPP') return

        try {
            const details = await getAppointmentById(String(meeting.id))
            const contact = buildContactNumber(details?.customer?.countryCode, details?.customer?.mobile)

            if (!contact) {
                setActionToast({ open: true, message: 'No customer mobile number available' })

                return
            }

            if (type === 'CALL') {
                window.location.href = `tel:${contact}`

                return
            }

            window.open(`https://wa.me/${contact}`, '_blank', 'noopener,noreferrer')
        } catch (e: any) {
            setActionToast({ open: true, message: e?.message || 'Unable to open contact action' })
        }
    }

    return (
        <Box className='flex flex-col' sx={{ gap: 3 }}>
            <DashboardHero
                tenantName={tenantName}
                userName={sessionUserName}
                tenantRole={tenantRole}
                agents={tenantUsers}
                viewingAgentId={viewingAgentId}
                onAgentChange={id => {
                    setHasAgentFilterOverride(true)
                    setViewingAgentId(id)
                }}
                isViewingAllAgents={isViewingAllAgents}
                period={hasTenant ? dashboardPeriod : undefined}
                onPeriodChange={hasTenant ? setDashboardPeriod : undefined}
                periodDisabled={myLeadsLoading}
            />
            {!checking && !hasMembership && (
                <Box className='mt-4 flex flex-col gap-2'>
                    {showWelcomeCta ? (
                        <>
                            <Typography variant='h6'>Welcome!</Typography>
                            <Typography color='text.secondary'>
                                Start by creating your organization to unlock your workspace. You can still invite DSAs
                                from Refer &amp; Earn before joining an organisation.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                <Button
                                    variant='contained'
                                    size='large'
                                    component={Link}
                                    href='/create-tenant'
                                    startIcon={<i className='ri-building-2-line' />}
                                >
                                    Create Organization
                                </Button>
                                <Button
                                    variant='outlined'
                                    size='large'
                                    component={Link}
                                    href='/refer-and-earn'
                                    startIcon={<i className='ri-gift-line' />}
                                >
                                    Refer &amp; Earn
                                </Button>
                            </Box>
                        </>
                    ) : (
                        <>
                            <Typography variant='h6'>Refer &amp; Earn is ready</Typography>
                            <Typography color='text.secondary'>
                                You don&apos;t need to join an organisation to invite DSAs and track rewards.
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                                <Button
                                    variant='contained'
                                    size='large'
                                    component={Link}
                                    href='/refer-and-earn'
                                    startIcon={<i className='ri-gift-line' />}
                                >
                                    Refer &amp; Earn
                                </Button>
                                <Button
                                    variant='outlined'
                                    size='large'
                                    component={Link}
                                    href='/rewards'
                                    startIcon={<i className='ri-medal-line' />}
                                >
                                    Rewards
                                </Button>
                            </Box>
                        </>
                    )}
                </Box>
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
                    gap: 2
                }}
            >
                <DashboardStatCard
                    label='Active customers'
                    value={hasTenant ? (myLeadsLoading ? '…' : activeCustomersCount.toLocaleString()) : '—'}
                    hint='Unique borrowers in open cases'
                    icon='ri-user-3-line'
                    accent='primary'
                    loading={hasTenant && myLeadsLoading}
                />
                <DashboardStatCard
                    label='Active approved value'
                    value={hasTenant ? (myLeadsLoading ? '…' : formatINR(activeCasesValue)) : '—'}
                    hint={`${hasTenant && !myLeadsLoading ? widgetMetrics.activeCases : '—'} open cases`}
                    icon='ri-hand-coin-line'
                    accent='success'
                    loading={hasTenant && myLeadsLoading}
                    highlight
                />
                <DashboardStatCard
                    label='Closed approved value'
                    value={hasTenant ? (myLeadsLoading ? '…' : formatINR(closedCasesValue)) : '—'}
                    hint={`${hasTenant && !myLeadsLoading ? closedCases.length : '—'} disbursed / closed`}
                    icon='ri-checkbox-circle-line'
                    accent='info'
                    loading={hasTenant && myLeadsLoading}
                />
                <DashboardStatCard
                    label='Rejected'
                    value={hasTenant ? (myLeadsLoading ? '…' : rejectedCases.length.toLocaleString()) : '—'}
                    hint={
                        rejectedStageIds.size === 0
                            ? 'Mark a Rejected stage in pipeline'
                            : 'Files tagged rejected'
                    }
                    icon='ri-close-circle-line'
                    accent='error'
                    loading={hasTenant && myLeadsLoading}
                />
                <DashboardStatCard
                    label='Progressive payment leads'
                    value={hasTenant ? (myLeadsLoading ? '…' : progressiveLeadsCount) : '—'}
                    hint='Eligible for staged disbursement'
                    icon='ri-funds-line'
                    accent='warning'
                    loading={hasTenant && myLeadsLoading}
                />
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' },
                    gap: 2,
                    alignItems: 'stretch'
                }}
            >
                <AgentWorkQueue
                    panel='queue'
                    hasTenant={hasTenant}
                    followUpsLoading={meetingsLoading}
                    casesLoading={myLeadsLoading}
                    error={meetingsError}
                    followUps={meetings}
                    activeCases={liveActiveCases}
                    onOpenContact={meeting => void openFollowUpContact(meeting)}
                />

                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', sm: 'row' },
                                alignItems: { xs: 'stretch', sm: 'flex-start' },
                                justifyContent: 'space-between',
                                gap: 2,
                                mb: 1.5
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='h6' sx={{ fontWeight: 700 }}>
                                    Pipeline by stage
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    Mix of live files by loan status
                                </Typography>
                            </Box>
                            <Button
                                component={Link}
                                href='/loan-cases/pipeline'
                                size='small'
                                variant='outlined'
                                sx={{ alignSelf: 'flex-start', flexShrink: 0 }}
                            >
                                Pipeline view
                            </Button>
                        </Box>
                        {hasTenant && !stagesError ? (
                            <Box sx={{ mb: 1.5 }}>
                                <BreakdownChartControls
                                    chartType={pipelineChartType}
                                    onChartType={setPipelineChartType}
                                    metric={pipelineMetric}
                                    onMetric={setPipelineMetric}
                                    topLimit={pipelineTop}
                                    onTopLimit={setPipelineTop}
                                    sortOrder={pipelineSort}
                                    onSortOrder={setPipelineSort}
                                    sortOptions={['pipeline', 'desc', 'asc', 'name']}
                                />
                            </Box>
                        ) : null}
                        {!hasTenant ? (
                            <Typography variant='body2' color='text.secondary'>
                                Select an organisation to view the pipeline.
                            </Typography>
                        ) : stagesError ? (
                            <Typography variant='body2' color='error'>
                                {stagesError}
                            </Typography>
                        ) : myLeadsLoading || stagesLoading ? (
                            <Typography variant='body2' color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
                                Loading pipeline…
                            </Typography>
                        ) : pipelineDisplay.length === 0 ? (
                            <Typography variant='body2' color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
                                No active cases in the pipeline.
                            </Typography>
                        ) : (
                            <>
                                <BreakdownApexChart
                                    points={pipelineDisplay}
                                    chartType={pipelineChartType}
                                    metric={pipelineMetric}
                                    accentColor={theme.palette.primary.main}
                                    darkMode={theme.palette.mode === 'dark'}
                                />
                                {pipelineLeadingStage ? (
                                    <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1 }}>
                                        Largest slice: {pipelineLeadingStage.label} ·{' '}
                                        {pipelineMetric === 'amount'
                                            ? formatINR(pipelineLeadingStage.value)
                                            : `${pipelineLeadingStage.count} cases`}
                                        {pipelineBreakdownRows.length > pipelineDisplay.length
                                            ? ` · ${pipelineBreakdownRows.length - pipelineDisplay.length} more in pipeline`
                                            : ''}
                                    </Typography>
                                ) : null}
                            </>
                        )}
                    </CardContent>
                </Card>
            </Box>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.05fr) minmax(0, 0.95fr)' },
                    gap: 2,
                    alignItems: 'stretch'
                }}
            >
                <AgentWorkQueue
                    panel='attention'
                    hasTenant={hasTenant}
                    followUpsLoading={meetingsLoading}
                    casesLoading={myLeadsLoading}
                    error={meetingsError}
                    followUps={meetings}
                    activeCases={liveActiveCases}
                    onOpenContact={meeting => void openFollowUpContact(meeting)}
                />

                <PipelineStagePulse
                    hasTenant={hasTenant}
                    loading={myLeadsLoading || stagesLoading}
                    cases={activeCases}
                    stages={stages}
                />
            </Box>
            <MonthlyPerformanceSection
                enabled={hasTenant}
                loading={monthlyPerformanceLoading}
                error={monthlyPerformanceError}
                data={monthlyPerformance}
                onRefresh={() => void refreshMonthlyPerformance()}
            />
            <DashboardAnalyticsSection
                leads={periodFilteredLeads}
                loading={myLeadsLoading}
                enabled={hasTenant}
                globalPeriodLabel={dashboardPeriodLabel}
            />
            <DisbursementInsightsSection
                enabled={hasTenant}
                assignedAgentId={effectiveAssignedAgentId}
                period={dashboardPeriod}
            />
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
            <Snackbar
                open={actionToast.open}
                autoHideDuration={3000}
                onClose={() => setActionToast(v => ({ ...v, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <SnackbarContent
                    sx={{
                        backgroundColor: 'rgb(var(--mui-palette-background-paperChannel) / 0.9)',
                        color: 'text.primary',
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        boxShadow: 'var(--mui-customShadows-sm, 0px 6px 18px rgba(0,0,0,0.16))',
                        px: 2,
                        py: 1.25
                    }}
                    message={actionToast.message}
                />
            </Snackbar>
            <OrganisationSetupSupportDialog
                open={supportOpen}
                onClose={() => setSupportOpen(false)}
                defaultFullName={String((session as any)?.user?.name || '')}
                defaultEmail={String((session as any)?.user?.email || '')}
            />
        </Box>
    )
}

export default DashboardHome
