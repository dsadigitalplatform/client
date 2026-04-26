'use client'

import { useEffect, useMemo, useState } from 'react'

import { useRouter, useSearchParams } from 'next/navigation'

import Link from 'next/link'
import dynamic from 'next/dynamic'

import type { ApexOptions } from 'apexcharts'

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
import { useTheme } from '@mui/material/styles'
import { useSession } from 'next-auth/react'

import { getLoanCases } from '@features/loan-cases/services/loanCasesService'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import { getAppointmentById, listAppointments } from '@features/appointments/services/appointments'
import type { AppointmentListItem } from '@features/appointments/services/appointments'
import OrganisationSetupSupportDialog from '@features/support/components/OrganisationSetupSupportDialog'

const DONUT_SIZE = 64
const AppReactApexCharts = dynamic(() => import('react-apexcharts'), { ssr: false })

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

type AmountBreakdownPoint = {
    label: string
    value: number
}

type TimelineMode = 'WEEK' | 'MONTH' | 'YEAR'

type TimelinePoint = {
    label: string
    value: number
    sortKey: number
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

const formatCompactINR = (amount: number) => {
    const safe = Number.isFinite(amount) ? amount : 0

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        notation: 'compact',
        maximumFractionDigits: 1
    }).format(safe)
}

const formatAxisAmount = (value: number) => {
    const safe = Number.isFinite(value) ? value : 0

    return `₹${new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(safe)}`
}

const BAR_PALETTE_LIGHT = ['#7C6CF8', '#21A8FF', '#46C95A', '#F4A261', '#EF476F', '#6C757D']
const BAR_PALETTE_DARK = ['#A493FF', '#73C8FF', '#78E08F', '#FFC385', '#FF89A0', '#B5BDC6']

const AmountBarTrendApexChart = ({
    points,
    darkMode,
    trendColor
}: {
    points: AmountBreakdownPoint[]
    darkMode: boolean
    trendColor: string
}) => {
    const palette = darkMode ? BAR_PALETTE_DARK : BAR_PALETTE_LIGHT
    const categories = points.map(p => p.label)
    const amounts = points.map(p => Number(p.value || 0))

    const options: ApexOptions = {
        chart: {
            type: 'line',
            stacked: false,
            toolbar: { show: false },
            parentHeightOffset: 0,
            fontFamily: 'inherit'
        },
        stroke: {
            width: [0, 2.5],
            curve: 'smooth'
        },
        markers: {
            size: 3.5,
            colors: [trendColor],
            strokeWidth: 0,
            hover: { sizeOffset: 2 }
        },
        colors: ['#7C6CF8', trendColor],
        fill: {
            opacity: [0.95, 1]
        },
        legend: { show: false },
        dataLabels: { enabled: false },
        plotOptions: {
            bar: {
                horizontal: false,
                distributed: true,
                columnWidth: '52%',
                borderRadius: 8
            }
        },
        grid: {
            borderColor: darkMode ? 'rgb(var(--mui-palette-dividerChannel) / 0.35)' : 'rgb(var(--mui-palette-dividerChannel) / 0.6)',
            strokeDashArray: 4,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } },
            padding: { left: 0, right: 8, top: 0, bottom: -8 }
        },
        xaxis: {
            categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '10px', fontWeight: '500' },
                rotate: -18,
                trim: true,
                hideOverlappingLabels: true
            },
            tooltip: { enabled: false }
        },
        yaxis: {
            labels: {
                style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '11px' },
                formatter: value => formatAxisAmount(Number(value))
            }
        },
        tooltip: {
            shared: true,
            intersect: false,
            x: { show: true },
            y: {
                formatter: value => formatINR(Number(value || 0))
            }
        }
    }

    return (
        <AppReactApexCharts
            type='line'
            height={220}
            options={{ ...options, colors: [...palette, trendColor] }}
            series={[
                { name: 'Amount', type: 'bar', data: amounts },
                { name: 'Trend', type: 'line', data: amounts }
            ]}
        />
    )
}

const TimelineApexChart = ({ points, darkMode }: { points: TimelinePoint[]; darkMode: boolean }) => {
    const labels = points.map(p => p.label)
    const values = points.map(p => Number(p.value || 0))

    const options: ApexOptions = {
        chart: {
            type: 'area',
            toolbar: { show: false },
            parentHeightOffset: 0,
            fontFamily: 'inherit'
        },
        colors: ['#00A6FB'],
        stroke: { curve: 'smooth', width: 2.8 },
        fill: {
            type: 'gradient',
            gradient: {
                shade: darkMode ? 'dark' : 'light',
                type: 'vertical',
                shadeIntensity: 0.25,
                opacityFrom: 0.4,
                opacityTo: 0.05,
                stops: [0, 95, 100]
            }
        },
        dataLabels: { enabled: false },
        markers: { size: 3, strokeWidth: 0, hover: { sizeOffset: 2 } },
        grid: {
            borderColor: darkMode ? 'rgb(var(--mui-palette-dividerChannel) / 0.35)' : 'rgb(var(--mui-palette-dividerChannel) / 0.6)',
            strokeDashArray: 4,
            padding: { left: 4, right: 4, top: 0, bottom: -6 }
        },
        xaxis: {
            categories: labels,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: {
                style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '11px' },
                rotate: 0,
                hideOverlappingLabels: true
            }
        },
        yaxis: {
            labels: {
                style: { colors: 'var(--mui-palette-text-secondary)', fontSize: '11px' },
                formatter: value => formatAxisAmount(Number(value))
            }
        },
        tooltip: {
            y: { formatter: value => formatINR(Number(value || 0)) }
        },
        legend: { show: false }
    }

    return <AppReactApexCharts type='area' height={220} options={options} series={[{ name: 'Loan Amount', data: values }]} />
}

const DashboardHome = () => {
    const theme = useTheme()
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
    const [remindersLoading, setRemindersLoading] = useState(false)
    const [remindersError, setRemindersError] = useState<string | null>(null)
    const [reminderTypeCounts, setReminderTypeCounts] = useState<Record<string, number>>({})
    const [stages, setStages] = useState<Array<{ id: string; name: string; order: number }>>([])
    const [stagesLoading, setStagesLoading] = useState(false)
    const [stagesError, setStagesError] = useState<string | null>(null)
    const [meetings, setMeetings] = useState<AppointmentListItem[]>([])
    const [meetingsLoading, setMeetingsLoading] = useState(false)
    const [meetingsError, setMeetingsError] = useState<string | null>(null)
    const [actionToast, setActionToast] = useState<{ open: boolean; message: string }>({ open: false, message: '' })
    const [supportOpen, setSupportOpen] = useState(false)
    const [supportAutoShown, setSupportAutoShown] = useState(false)

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
                const now = new Date()
                const endOfTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

                const items = await listAppointments({ organizerId: sessionUserId, dateFrom: now, dateTo: endOfTwoWeeks })

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
    }, [currentTenantId, sessionUserId])

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

    const showWelcomeCta = isSuperAdmin && !hasMembership && !checking
    const hasTenant = Boolean(currentTenantId)
    const isDarkMode = theme.palette.mode === 'dark'

    useEffect(() => {
        if (checking || isSuperAdmin || hasMembership || supportAutoShown) return

        setSupportOpen(true)
        setSupportAutoShown(true)
    }, [checking, isSuperAdmin, hasMembership, supportAutoShown])

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

    const bankWiseSums = useMemo<AmountBreakdownPoint[]>(() => {
        const byBank = new Map<string, number>()

        myLeads.forEach(c => {
            const amount = typeof c.requestedAmount === 'number' ? c.requestedAmount : 0

            if (amount <= 0) return

            const label = String(c.bankName || '').trim() || 'Unspecified bank'

            byBank.set(label, (byBank.get(label) || 0) + amount)
        })

        return Array.from(byBank.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
    }, [myLeads])

    const loanTypeWiseSums = useMemo<AmountBreakdownPoint[]>(() => {
        const byLoanType = new Map<string, number>()

        myLeads.forEach(c => {
            const amount = typeof c.requestedAmount === 'number' ? c.requestedAmount : 0

            if (amount <= 0) return

            const label = String(c.loanTypeName || '').trim() || 'Unspecified loan type'

            byLoanType.set(label, (byLoanType.get(label) || 0) + amount)
        })

        return Array.from(byLoanType.entries())
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6)
    }, [myLeads])

    const timelineSummary = useMemo<{ mode: TimelineMode; points: TimelinePoint[] }>(() => {
        const dated = myLeads
            .map(c => {
                const amount = typeof c.requestedAmount === 'number' ? c.requestedAmount : 0
                const date = c.updatedAt ? new Date(c.updatedAt) : null

                if (!date || !Number.isFinite(date.getTime()) || amount <= 0) return null

                return { date, amount }
            })
            .filter(Boolean) as Array<{ date: Date; amount: number }>

        if (dated.length === 0) return { mode: 'WEEK', points: [] }

        const minTs = Math.min(...dated.map(r => r.date.getTime()))
        const maxTs = Math.max(...dated.map(r => r.date.getTime()))
        const spanDays = Math.max(1, Math.ceil((maxTs - minTs) / (1000 * 60 * 60 * 24)))

        const mode: TimelineMode =
            dated.length <= 20 || spanDays <= 70 ? 'WEEK' : dated.length <= 120 || spanDays <= 500 ? 'MONTH' : 'YEAR'

        const buckets = new Map<string, TimelinePoint>()

        dated.forEach(r => {
            const d = new Date(r.date)
            let key = ''
            let label = ''
            let sortKey = 0

            if (mode === 'WEEK') {
                const day = d.getDay()
                const diff = day === 0 ? -6 : 1 - day

                d.setDate(d.getDate() + diff)
                d.setHours(0, 0, 0, 0)
                key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
                label = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(d)
                sortKey = d.getTime()
            } else if (mode === 'MONTH') {
                d.setDate(1)
                d.setHours(0, 0, 0, 0)
                key = `${d.getFullYear()}-${d.getMonth() + 1}`
                label = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' }).format(d)
                sortKey = d.getTime()
            } else {
                d.setMonth(0, 1)
                d.setHours(0, 0, 0, 0)
                key = `${d.getFullYear()}`
                label = String(d.getFullYear())
                sortKey = d.getTime()
            }

            const prev = buckets.get(key)

            if (prev) {
                prev.value += r.amount
            } else {
                buckets.set(key, { label, value: r.amount, sortKey })
            }
        })

        const sorted = Array.from(buckets.values()).sort((a, b) => a.sortKey - b.sortKey)
        const maxPoints = mode === 'WEEK' ? 10 : mode === 'MONTH' ? 12 : 8

        return { mode, points: sorted.slice(-maxPoints) }
    }, [myLeads])

    const bankWiseTotal = useMemo(() => bankWiseSums.reduce((sum, row) => sum + row.value, 0), [bankWiseSums])
    const loanTypeWiseTotal = useMemo(() => loanTypeWiseSums.reduce((sum, row) => sum + row.value, 0), [loanTypeWiseSums])

    const timelineTotal = useMemo(
        () => timelineSummary.points.reduce((sum, row) => sum + row.value, 0),
        [timelineSummary.points]
    )

    const timelineModeLabel = timelineSummary.mode === 'WEEK' ? 'Weekly' : timelineSummary.mode === 'MONTH' ? 'Monthly' : 'Yearly'

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
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <SegmentedDonut
                                    segments={reminderTypeSegments}
                                    axisLabel='Follow-ups by type in the next 2 weeks'
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
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' }, gap: 2 }}>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 0.5 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    Bank wise loan sum
                                </Typography>
                                <Typography variant='h6' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : formatINR(bankWiseTotal)) : '—'}
                                </Typography>
                            </Box>
                            <Avatar
                                sx={{
                                    width: 38,
                                    height: 38,
                                    bgcolor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                                    color: 'var(--mui-palette-primary-main)'
                                }}
                            >
                                <i className='ri-bank-line' />
                            </Avatar>
                        </Box>
                        {!hasTenant ? (
                            <Typography variant='body2' color='text.secondary'>
                                Select an organization to view bank analytics.
                            </Typography>
                        ) : myLeadsLoading ? (
                            <Typography variant='body2' color='text.secondary'>
                                Loading bank analytics...
                            </Typography>
                        ) : bankWiseSums.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No amount data available.
                            </Typography>
                        ) : (
                            <>
                                <AmountBarTrendApexChart
                                    points={bankWiseSums}
                                    trendColor='var(--mui-palette-primary-main)'
                                    darkMode={isDarkMode}
                                />
                                <Typography variant='caption' color='text.secondary'>
                                    Top bank: {bankWiseSums[0]?.label} · {formatCompactINR(bankWiseSums[0]?.value || 0)}
                                </Typography>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 0.5 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    Loan type wise sum
                                </Typography>
                                <Typography variant='h6' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : formatINR(loanTypeWiseTotal)) : '—'}
                                </Typography>
                            </Box>
                            <Avatar
                                sx={{
                                    width: 38,
                                    height: 38,
                                    bgcolor: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)',
                                    color: 'var(--mui-palette-success-main)'
                                }}
                            >
                                <i className='ri-file-chart-line' />
                            </Avatar>
                        </Box>
                        {!hasTenant ? (
                            <Typography variant='body2' color='text.secondary'>
                                Select an organization to view loan type analytics.
                            </Typography>
                        ) : myLeadsLoading ? (
                            <Typography variant='body2' color='text.secondary'>
                                Loading loan type analytics...
                            </Typography>
                        ) : loanTypeWiseSums.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No amount data available.
                            </Typography>
                        ) : (
                            <>
                                <AmountBarTrendApexChart
                                    points={loanTypeWiseSums}
                                    trendColor='var(--mui-palette-success-main)'
                                    darkMode={isDarkMode}
                                />
                                <Typography variant='caption' color='text.secondary'>
                                    Top loan type: {loanTypeWiseSums[0]?.label} · {formatCompactINR(loanTypeWiseSums[0]?.value || 0)}
                                </Typography>
                            </>
                        )}
                    </CardContent>
                </Card>
                <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, mb: 0.75 }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant='subtitle2' color='text.secondary'>
                                    Loan amount timeline
                                </Typography>
                                <Typography variant='h6' sx={{ fontWeight: 800 }}>
                                    {hasTenant ? (myLeadsLoading ? '...' : formatINR(timelineTotal)) : '—'}
                                </Typography>
                            </Box>
                            <Chip size='small' variant='outlined' label={timelineModeLabel} />
                        </Box>
                        {!hasTenant ? (
                            <Typography variant='body2' color='text.secondary'>
                                Select an organization to view timeline analytics.
                            </Typography>
                        ) : myLeadsLoading ? (
                            <Typography variant='body2' color='text.secondary'>
                                Loading timeline analytics...
                            </Typography>
                        ) : timelineSummary.points.length === 0 ? (
                            <Typography variant='body2' color='text.secondary'>
                                No timeline data available.
                            </Typography>
                        ) : (
                            <>
                                <TimelineApexChart
                                    points={timelineSummary.points}
                                    darkMode={isDarkMode}
                                />
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                    <Typography variant='caption' color='text.secondary'>
                                        {timelineSummary.points[0]?.label}
                                    </Typography>
                                    <Typography variant='caption' color='text.secondary'>
                                        {timelineSummary.points[timelineSummary.points.length - 1]?.label}
                                    </Typography>
                                </Box>
                            </>
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
