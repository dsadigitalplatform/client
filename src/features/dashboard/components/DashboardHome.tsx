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
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
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

const DONUT_SIZE = 64

const formatINR = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0

    return `₹ ${safe.toLocaleString('en-IN')}`
}

const FOLLOW_UP_COLORS = {
    CALL: { main: 'var(--mui-palette-info-main)', bg: 'rgb(var(--mui-palette-info-mainChannel) / 0.12)' },
    WHATSAPP: { main: 'var(--mui-palette-success-main)', bg: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)' },
    VISIT: { main: 'var(--mui-palette-warning-main)', bg: 'rgb(var(--mui-palette-warning-mainChannel) / 0.12)' },
    EMAIL: { main: 'var(--mui-palette-secondary-main)', bg: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.12)' },
    OTHER: { main: 'var(--mui-palette-text-secondary)', bg: 'rgb(var(--mui-palette-dividerChannel) / 0.24)' }
}

type DonutSegment = {
    label: string
    value: number
    color: string
}

const SegmentedDonut = ({
    segments,
    axisLabel
}: {
    segments: DonutSegment[]
    axisLabel?: string
}) => {
    const total = segments.reduce((sum, s) => sum + s.value, 0)
    const r = 26
    const c = 2 * Math.PI * r
    let offset = 0
    const [hovered, setHovered] = useState<DonutSegment | null>(null)
    const hoverPct = hovered && total > 0 ? Math.round((hovered.value / total) * 100) : null

    return (
        <svg width={DONUT_SIZE} height={DONUT_SIZE} viewBox='0 0 64 64' aria-hidden={axisLabel ? undefined : 'true'} aria-label={axisLabel}>
            {axisLabel ? <title>{axisLabel}</title> : null}
            <circle cx='32' cy='32' r={r} fill='none' stroke='rgb(var(--mui-palette-dividerChannel) / 0.2)' strokeWidth='8' />
            {segments
                .filter(s => s.value > 0)
                .map((s, idx) => {
                    const dash = total > 0 ? (s.value / total) * c : 0

                    const circle = (
                        <circle
                            key={`${s.label}-${idx}`}
                            cx='32'
                            cy='32'
                            r={r}
                            fill='none'
                            stroke={s.color}
                            strokeWidth='8'
                            strokeDasharray={`${dash} ${c - dash}`}
                            strokeDashoffset={-offset}
                            transform='rotate(-90 32 32)'
                            onMouseEnter={() => setHovered(s)}
                            onMouseLeave={() => setHovered(null)}
                        />
                    )

                    offset += dash

                    return circle
                })}
            {hovered && hoverPct != null ? (
                <>
                    <text x='32' y='30' textAnchor='middle' fontSize='12' fontWeight='700' fill='var(--mui-palette-text-primary)'>
                        {hoverPct}%
                    </text>
                    <text x='32' y='42' textAnchor='middle' fontSize='9' fill='var(--mui-palette-text-secondary)'>
                        {hovered.label}
                    </text>
                </>
            ) : (
                <>
                    <text x='32' y='30' textAnchor='middle' fontSize='12' fontWeight='700' fill='var(--mui-palette-text-primary)'>
                        {total}
                    </text>
                    <text x='32' y='42' textAnchor='middle' fontSize='9' fill='var(--mui-palette-text-secondary)'>
                        Follow-ups
                    </text>
                </>
            )}
        </svg>
    )
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
    const [remindersNextTwoWeeks, setRemindersNextTwoWeeks] = useState(0)
    const [remindersLoading, setRemindersLoading] = useState(false)
    const [remindersError, setRemindersError] = useState<string | null>(null)
    const [reminderTypeCounts, setReminderTypeCounts] = useState<Record<string, number>>({})
    const [stages, setStages] = useState<Array<{ id: string; name: string; order: number; isLoggedIn: boolean; isDisbursed: boolean }>>([])
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
                const now = new Date()
                const endOfTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

                const items = await listAppointments({
                    ...(effectiveAssignedAgentId ? { organizerId: effectiveAssignedAgentId } : {}),
                    dateFrom: now,
                    dateTo: endOfTwoWeeks
                })

                const filtered = items.filter(a => {
                    if (!a?.scheduledAt) return false
                    const dt = new Date(a.scheduledAt)

                    return Number.isFinite(dt.getTime()) && dt.getTime() >= now.getTime() && dt.getTime() <= endOfTwoWeeks.getTime()
                })

                const counts: Record<string, number> = { CALL: 0, WHATSAPP: 0, VISIT: 0, EMAIL: 0, OTHER: 0 }

                filtered.forEach(a => {
                    const raw = String(a?.followUpType || '').toUpperCase()

                    if (raw === 'CALL' || raw === 'WHATSAPP' || raw === 'VISIT' || raw === 'EMAIL') counts[raw] += 1
                    else counts.OTHER += 1
                })

                if (active) setRemindersNextTwoWeeks(filtered.length)
                if (active) setReminderTypeCounts(counts)
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
    }, [currentTenantId, effectiveAssignedAgentId, sessionUserId])

    const reminderTypeSegments = useMemo(() => {
        const meta: Array<DonutSegment & { key: string }> = [
            { key: 'CALL', label: 'Call', value: 0, color: FOLLOW_UP_COLORS.CALL.main },
            { key: 'WHATSAPP', label: 'WhatsApp', value: 0, color: FOLLOW_UP_COLORS.WHATSAPP.main },
            { key: 'VISIT', label: 'Visit', value: 0, color: FOLLOW_UP_COLORS.VISIT.main },
            { key: 'EMAIL', label: 'Email', value: 0, color: FOLLOW_UP_COLORS.EMAIL.main },
            { key: 'OTHER', label: 'Other', value: 0, color: FOLLOW_UP_COLORS.OTHER.main }
        ]

        return meta.map(m => ({ ...m, value: reminderTypeCounts[m.key] ?? 0 }))
    }, [reminderTypeCounts])

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
                const items = await listAppointments({
                    ...(effectiveAssignedAgentId ? { organizerId: effectiveAssignedAgentId } : {}),
                    dateFrom: now,
                    dateTo: end
                })

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
                        isDisbursed: Boolean(s?.isDisbursed)
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

    const closedStageIds = useMemo(() => {
        const flagged = stages.filter(s => s.isDisbursed).map(s => s.id)

        if (flagged.length > 0) return new Set(flagged)

        const finalStage = stages.reduce<{ id: string; name: string; order: number } | null>((max, s) => {
            if (!max) return s
            if ((s.order || 0) > (max.order || 0)) return s

            return max
        }, null)

        return finalStage ? new Set([finalStage.id]) : new Set<string>()
    }, [stages])

    const periodFilteredLeads = useMemo(
        () =>
            filterByDashboardPeriod(myLeads, c => (c.updatedAt ? new Date(c.updatedAt) : null), dashboardPeriod),
        [myLeads, dashboardPeriod]
    )

    const dashboardPeriodLabel = useMemo(() => formatDashboardPeriodLabel(dashboardPeriod), [dashboardPeriod])

    const widgetMetrics = useMemo(() => {
        const totalLeads = periodFilteredLeads.length
        const disbursements = Array.from(periodFilteredLeads).filter(c => disbursementStageIds.has(c.stageId)).length
        const activeCases = closedStageIds.size
            ? periodFilteredLeads.filter(c => !closedStageIds.has(c.stageId)).length
            : totalLeads

        return { totalLeads, activeCases, disbursements }
    }, [periodFilteredLeads, disbursementStageIds, closedStageIds])

    const activeCases = useMemo(() => {
        if (closedStageIds.size === 0) return periodFilteredLeads

        return periodFilteredLeads.filter(c => !closedStageIds.has(c.stageId))
    }, [periodFilteredLeads, closedStageIds])

    const activeCasesValue = useMemo(() => {
        return activeCases.reduce((acc, c) => (typeof c.requestedAmount === 'number' ? acc + c.requestedAmount : acc), 0)
    }, [activeCases])

    const closedCases = useMemo(() => {
        if (closedStageIds.size === 0) return []

        return periodFilteredLeads.filter(c => closedStageIds.has(c.stageId))
    }, [periodFilteredLeads, closedStageIds])

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

    const pipelineLeadingStage = pipelineDisplay[0]

    const meetingTitle = (m: AppointmentListItem) => {
        if (m?.customerName) return m.customerName
        if (m?.leadTitle) return m.leadTitle
        if (m?.followUpType) return `${String(m.followUpType).toLowerCase()} follow-up`

        return 'Meeting'
    }

    const meetingTypeMeta = (m: AppointmentListItem) => {
        const t = String(m?.followUpType || '').toUpperCase()

        if (t === 'CALL') return { label: 'Call', icon: 'ri-phone-line', color: FOLLOW_UP_COLORS.CALL.bg, text: FOLLOW_UP_COLORS.CALL.main }
        if (t === 'WHATSAPP') return { label: 'WhatsApp', icon: 'ri-whatsapp-line', color: FOLLOW_UP_COLORS.WHATSAPP.bg, text: FOLLOW_UP_COLORS.WHATSAPP.main }
        if (t === 'VISIT') return { label: 'Visit', icon: 'ri-map-pin-line', color: FOLLOW_UP_COLORS.VISIT.bg, text: FOLLOW_UP_COLORS.VISIT.main }
        if (t === 'EMAIL') return { label: 'Email', icon: 'ri-mail-line', color: FOLLOW_UP_COLORS.EMAIL.bg, text: FOLLOW_UP_COLORS.EMAIL.main }

        return { label: 'Meeting', icon: 'ri-calendar-event-line', color: FOLLOW_UP_COLORS.OTHER.bg, text: FOLLOW_UP_COLORS.OTHER.main }
    }

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
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
                    gap: 2
                }}
            >
                <DashboardStatCard
                    label='Follow-ups (2 weeks)'
                    value={hasTenant ? (remindersLoading ? '…' : remindersNextTwoWeeks) : '—'}
                    hint={
                        !hasTenant
                            ? 'Select an organisation'
                            : remindersError || 'Scheduled touchpoints'
                    }
                    icon='ri-calendar-schedule-line'
                    accent='info'
                    loading={hasTenant && remindersLoading}
                    footer={
                        hasTenant && !remindersError ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <SegmentedDonut segments={reminderTypeSegments} axisLabel='Follow-ups by type' />
                            </Box>
                        ) : undefined
                    }
                />
                <DashboardStatCard
                    label='Active customers'
                    value={hasTenant ? (myLeadsLoading ? '…' : activeCustomersCount.toLocaleString()) : '—'}
                    hint='Unique borrowers in open cases'
                    icon='ri-user-3-line'
                    accent='primary'
                    loading={hasTenant && myLeadsLoading}
                />
                <DashboardStatCard
                    label='Active pipeline value'
                    value={hasTenant ? (myLeadsLoading ? '…' : formatINR(activeCasesValue)) : '—'}
                    hint={`${hasTenant && !myLeadsLoading ? widgetMetrics.activeCases : '—'} open cases`}
                    icon='ri-hand-coin-line'
                    accent='success'
                    loading={hasTenant && myLeadsLoading}
                    highlight
                />
                <DashboardStatCard
                    label='Closed / disbursed value'
                    value={hasTenant ? (myLeadsLoading ? '…' : formatINR(closedCasesValue)) : '—'}
                    hint={`${hasTenant && !myLeadsLoading ? closedCases.length : '—'} closed cases`}
                    icon='ri-checkbox-circle-line'
                    accent='info'
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

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr', lg: '2fr 1fr' }, gap: 2 }}>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Box>
                                <Typography variant='h6' sx={{ fontWeight: 700 }}>
                                    Upcoming follow-ups
                                </Typography>
                                <Typography variant='body2' color='text.secondary'>
                                    Next two weeks · tap Call or WhatsApp to connect
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
                                    const followUpType = String(m?.followUpType || '').toUpperCase()
                                    const canOpenContact = followUpType === 'CALL' || followUpType === 'WHATSAPP'

                                    return (
                                        <Box
                                            key={m.id}
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1.5,
                                                px: 0.75,
                                                py: 0.75,
                                                borderRadius: 2,
                                                backgroundColor: 'transparent',
                                                transition: 'background-color 120ms ease',
                                                '&:hover': { backgroundColor: 'action.hover' }
                                            }}
                                        >
                                            <Avatar
                                                sx={{
                                                    width: 36,
                                                    height: 36,
                                                    bgcolor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                                                    color: 'var(--mui-palette-primary-main)',
                                                    fontSize: '0.85rem',
                                                    fontWeight: 700
                                                }}
                                            >
                                                {initials(label)}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, minWidth: 0, flexWrap: 'wrap' }}>
                                                    <Typography variant='subtitle2' sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                                                        {title}
                                                    </Typography>
                                                    {m?.customerIsNRI ? (
                                                        <Chip
                                                            size='small'
                                                            label='NRI'
                                                            variant='outlined'
                                                            icon={<i className='ri-global-line' />}
                                                            sx={{
                                                                boxShadow: 'none',
                                                                borderColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.5)',
                                                                color: 'warning.main',
                                                                backgroundColor: 'rgb(var(--mui-palette-warning-mainChannel) / 0.08)'
                                                            }}
                                                        />
                                                    ) : null}
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75, mt: 0.25 }}>
                                                    <Box
                                                        component='span'
                                                        sx={{ display: 'inline-flex', alignItems: 'center', color: 'text.secondary', '& i': { fontSize: '0.95rem' } }}
                                                    >
                                                        <i className='ri-calendar-event-line' />
                                                    </Box>
                                                    <Typography variant='caption' color='text.secondary' noWrap sx={{ lineHeight: 1.2 }}>
                                                        {formatMeetingTime(m)}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                            <Box
                                                role={canOpenContact ? 'button' : undefined}
                                                tabIndex={canOpenContact ? 0 : undefined}
                                                onClick={canOpenContact ? () => void openFollowUpContact(m) : undefined}
                                                onKeyDown={
                                                    canOpenContact
                                                        ? e => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault()
                                                                void openFollowUpContact(m)
                                                            }
                                                        }
                                                        : undefined
                                                }
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.5,
                                                    px: 1,
                                                    height: 24,
                                                    borderRadius: 999,
                                                    backgroundColor: tag.color,
                                                    color: tag.text,
                                                    fontSize: '0.72rem',
                                                    fontWeight: 600,
                                                    whiteSpace: 'nowrap',
                                                    cursor: canOpenContact ? 'pointer' : 'default',
                                                    border: 'none',
                                                    '& i': { fontSize: '0.95rem' }
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
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
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
                                    {hasTenant && !myLeadsLoading
                                        ? `${widgetMetrics.activeCases} active cases · ${formatINR(activeCasesValue)}`
                                        : 'Open cases across your loan status pipeline'}
                                </Typography>
                            </Box>
                            <Button
                                component={Link}
                                href='/loan-cases/pipeline'
                                size='small'
                                variant='outlined'
                                sx={{ alignSelf: { xs: 'flex-start', sm: 'flex-start' }, flexShrink: 0 }}
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
                                        Leading: {pipelineLeadingStage.label} ·{' '}
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
