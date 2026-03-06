'use client'

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import Link from 'next/link'

import { useSession } from 'next-auth/react'

import useSWR from 'swr'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import IconButton from '@mui/material/IconButton'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import AppointmentDetailsDialog from '@features/appointments/components/AppointmentDetailsDialog'
import { listAppointments, listAppointmentsByLead } from '@features/appointments/services/appointments'
import type { AppointmentStatus } from '@features/appointments/appointments.types'
import type { AppointmentListItem } from '@features/appointments/services/appointments'

type Props = {
    leadId?: string
    embedded?: boolean
    refreshKey?: number
    onLoaded?: (count: number) => void
}

type TenantUser = {
    id: string
    name: string
    email: string | null
}

type AppointmentTreeNode = {
    item: AppointmentListItem
    children: AppointmentTreeNode[]
}

function formatDateTime(v: string | null) {
    if (!v) return '-'
    const d = new Date(v)

    if (Number.isNaN(d.getTime())) return '-'

    return new Intl.DateTimeFormat('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    }).format(d)
}

function statusChip(status: string) {
    const s = status === 'SCHEDULED' ? 'PENDING' : status

    if (s === 'COMPLETED') return { label: 'Completed', color: 'success' as const }
    if (s === 'CANCELLED') return { label: 'Cancelled', color: 'error' as const }
    if (s === 'RESCHEDULED') return { label: 'Rescheduled', color: 'warning' as const }
    if (s === 'NO_SHOW') return { label: 'No Show', color: 'default' as const }

    return { label: 'Pending', color: 'info' as const }
}

function formatLeadGroupHeading(leadTitle: string | null | undefined, customerName: string | null | undefined) {
    const title = String(leadTitle || '').trim()
    const customer = String(customerName || '').trim()
    const [loanTypeRaw, bankRaw] = title.split('•').map(v => v.trim())
    const loanType = loanTypeRaw || ''
    const bank = bankRaw || ''

    if (loanType && customer && bank) return `${loanType} for ${customer} @ ${bank}`
    if (loanType && customer) return `${loanType} for ${customer}`
    if (customer && bank) return `Loan for ${customer} @ ${bank}`
    if (loanType && bank) return `${loanType} @ ${bank}`
    if (loanType) return loanType
    if (customer) return `Loan for ${customer}`

    return 'Lead Appointments'
}

function getSortedDescendants(node: AppointmentTreeNode): AppointmentTreeNode[] {
    const out: AppointmentTreeNode[] = []

    const walk = (nodes: AppointmentTreeNode[]) => {
        nodes.forEach(child => {
            out.push(child)
            walk(child.children)
        })
    }

    walk(node.children)
    out.sort((a, b) => String(a.item?.scheduledAt || '').localeCompare(String(b.item?.scheduledAt || '')))

    return out
}

export default function LeadAppointmentsDashboard({ leadId, embedded = false, refreshKey, onLoaded }: Props) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

    const { data: session } = useSession()
    const sessionUserId = String((session as any)?.userId || '')
    const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

    const fetcher = useCallback((url: string) => fetch(url, { cache: 'no-store' }).then(r => r.json()), [])

    const { data: tenantInfo } = useSWR('/api/session/tenant', fetcher, { revalidateOnFocus: false })
    const tenantRole = (tenantInfo as any)?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined
    const isAdminOrOwner = tenantRole === 'OWNER' || tenantRole === 'ADMIN' || isSuperAdmin

    const { data: tenantUsersData } = useSWR(tenantInfo?.currentTenantId ? '/api/tenant-users' : null, fetcher, {
        revalidateOnFocus: false
    })

    const tenantUsers = (Array.isArray((tenantUsersData as any)?.users) ? (tenantUsersData as any).users : []) as TenantUser[]

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [appointments, setAppointments] = useState<AppointmentListItem[]>([])

    const [view, setView] = useState<'list' | 'kanban'>('list')

    const [organizerId, setOrganizerId] = useState<string>('')
    const [status, setStatus] = useState<string>('')
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')

    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detailsTab, setDetailsTab] = useState<'details' | 'followup'>('details')
    const [collapsedFollowUpNodes, setCollapsedFollowUpNodes] = useState<Record<string, boolean>>({})
    const [lastUpdatedId, setLastUpdatedId] = useState<string | null>(null)
    const onLoadedRef = useRef<Props['onLoaded']>(onLoaded)

    useEffect(() => {
        onLoadedRef.current = onLoaded
    }, [onLoaded])

    useEffect(() => {
        if (!sessionUserId) return

        setOrganizerId(v => (v ? v : sessionUserId))
    }, [sessionUserId])

    useEffect(() => {
        if (!sessionUserId) return
        if (isAdminOrOwner) return

        setOrganizerId(sessionUserId)
    }, [isAdminOrOwner, sessionUserId])

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const baseParams = {
                organizerId: organizerId || undefined,
                status: (status || undefined) as AppointmentStatus | undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            }

            const rows = leadId ? await listAppointmentsByLead(leadId, baseParams) : await listAppointments(baseParams)

            setAppointments(rows)

            const cb = onLoadedRef.current

            if (cb) cb(rows.length)
        } catch (e: any) {
            setAppointments([])
            setError(e?.message || 'Failed to load appointments')
        } finally {
            setLoading(false)
        }
    }, [leadId, organizerId, status, dateFrom, dateTo])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useEffect(() => {
        if (refreshKey == null) return

        void refresh()
    }, [refreshKey, refresh])

    useEffect(() => {
        if (!lastUpdatedId) return
        const t = setTimeout(() => setLastUpdatedId(null), 3000)

        return () => clearTimeout(t)
    }, [lastUpdatedId])

    const grouped = useMemo(() => {
        const out: Record<string, any[]> = { PENDING: [], COMPLETED: [], RESCHEDULED: [], CANCELLED: [] }

        appointments.forEach(a => {
            const key = String(a?.status || 'PENDING') === 'SCHEDULED' ? 'PENDING' : String(a?.status || 'PENDING')

            if (!out[key]) out[key] = []
            out[key].push(a)
        })

        Object.values(out).forEach(arr => arr.sort((a, b) => String(a?.scheduledAt || '').localeCompare(String(b?.scheduledAt || ''))))

        return out
    }, [appointments])

    const latestAppointmentByCase = useMemo(() => {
        const map = new Map<string, AppointmentListItem>()

        const getTimeValue = (a: AppointmentListItem) => {
            const scheduledTime = a?.scheduledAt ? new Date(a.scheduledAt).getTime() : NaN
            const updatedTime = a?.updatedAt ? new Date(a.updatedAt).getTime() : NaN

            if (!Number.isNaN(scheduledTime)) return scheduledTime
            if (!Number.isNaN(updatedTime)) return updatedTime

            return 0
        }

        appointments.forEach(a => {
            const key = String(a?.caseId || a?.leadId || a?.id || 'UNASSIGNED')
            const existing = map.get(key)

            if (!existing) {
                map.set(key, a)

                return
            }

            if (getTimeValue(a) >= getTimeValue(existing)) map.set(key, a)
        })

        return map
    }, [appointments])

    const leadTreeGroups = useMemo(() => {
        const leadBuckets = new Map<string, AppointmentListItem[]>()

        appointments.forEach(a => {
            const key = String(a?.leadId || 'UNASSIGNED')
            const arr = leadBuckets.get(key) || []

            arr.push(a)
            leadBuckets.set(key, arr)
        })

        const buildTree = (items: AppointmentListItem[]) => {
            const nodeById = new Map<string, AppointmentTreeNode>()

            items.forEach(item => {
                nodeById.set(String(item.id), { item, children: [] })
            })

            const roots: AppointmentTreeNode[] = []

            nodeById.forEach(node => {
                const parentId = node.item.parentAppointmentId ? String(node.item.parentAppointmentId) : ''
                const parent = parentId ? nodeById.get(parentId) : undefined

                if (parent) parent.children.push(node)
                else roots.push(node)
            })

            const sortTree = (nodes: AppointmentTreeNode[]) => {
                nodes.sort((a, b) => String(a.item?.scheduledAt || '').localeCompare(String(b.item?.scheduledAt || '')))
                nodes.forEach(n => sortTree(n.children))
            }

            sortTree(roots)

            return roots
        }

        const groups = Array.from(leadBuckets.entries()).map(([groupLeadId, groupItems]) => {
            const roots = buildTree(groupItems)
            const previewItem = roots[0]?.item || groupItems[0]
            const leadLabel = formatLeadGroupHeading(previewItem?.leadTitle, previewItem?.customerName)

            return {
                leadId: groupLeadId,
                leadLabel,
                roots,
                count: groupItems.length
            }
        })

        groups.sort((a, b) => a.leadLabel.localeCompare(b.leadLabel))

        return groups
    }, [appointments])

    useEffect(() => {
        setCollapsedFollowUpNodes(prev => {
            const next = { ...prev }

            leadTreeGroups.forEach(group => {
                group.roots.forEach(root => {
                    if (getSortedDescendants(root).length > 0 && typeof next[String(root.item.id)] !== 'boolean') {
                        next[String(root.item.id)] = true
                    }
                })
            })

            return next
        })
    }, [leadTreeGroups])

    const isNodeCollapsed = (nodeId: string) => Boolean(collapsedFollowUpNodes[nodeId])

    const toggleNode = (nodeId: string) => {
        setCollapsedFollowUpNodes(prev => ({
            ...prev,
            [nodeId]: !prev[nodeId]
        }))
    }

    const openDetails = (id: string, tab: 'details' | 'followup') => {
        setSelectedId(id)
        setDetailsTab(tab)
        setDetailsOpen(true)
    }

    const closeDetails = () => {
        setDetailsOpen(false)
        setSelectedId(null)
    }

    const handleUpdated = (id?: string | null) => {
        if (id) setLastUpdatedId(String(id))
        void refresh()
    }

    const isHighlighted = (id: string) => lastUpdatedId === id

    const canAddFollowUp = (a: AppointmentListItem) => {
        const key = String(a?.caseId || a?.leadId || a?.id || 'UNASSIGNED')
        const latest = latestAppointmentByCase.get(key)

        return latest ? String(latest.id) === String(a?.id || '') : true
    }

    const clearNonOrganizerFilters = () => {
        setStatus('')
        setDateFrom('')
        setDateTo('')
    }

    const header = (
        <Box
            sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'stretch', sm: 'center' },
                gap: 2,
                justifyContent: 'space-between'
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
                <Typography variant='h5'>Appointments</Typography>
                <Typography variant='body2' color='text.secondary'>
                    {leadId ? 'Track outcomes and follow-ups for this lead' : 'Track outcomes and follow-ups across all leads'}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, justifyContent: { xs: 'stretch', sm: 'flex-end' }, flex: 1 }}>
                <Button
                    variant={view === 'list' ? 'contained' : 'outlined'}
                    onClick={() => setView('list')}
                    fullWidth={isMobile}
                >
                    List
                </Button>
                <Button
                    variant={view === 'kanban' ? 'contained' : 'outlined'}
                    onClick={() => setView('kanban')}
                    fullWidth={isMobile}
                >
                    Kanban
                </Button>
            </Box>
        </Box>
    )

    const filters = (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
                    gap: 2
                }}
            >
                <FormControl size='small' fullWidth>
                    <InputLabel id='appointments-organizer-filter'>Organizer</InputLabel>
                    <Select
                        labelId='appointments-organizer-filter'
                        label='Organizer'
                        value={organizerId}
                        onChange={e => setOrganizerId(String(e.target.value))}
                        disabled={!isAdminOrOwner}
                    >
                        {isAdminOrOwner ? <MenuItem value=''>All</MenuItem> : null}
                        {tenantUsers.map(u => {
                            const label = String(u?.name || u?.email || u?.id || '').trim() || 'User'
                            const isYou = sessionUserId && String(u.id) === sessionUserId

                            return (
                                <MenuItem key={u.id} value={u.id}>
                                    {label}
                                    {isYou ? ' (You)' : ''}
                                </MenuItem>
                            )
                        })}
                        {sessionUserId && !tenantUsers.some(u => String(u.id) === sessionUserId) ? (
                            <MenuItem value={sessionUserId}>You</MenuItem>
                        ) : null}
                    </Select>
                </FormControl>

                <FormControl size='small' fullWidth>
                    <InputLabel id='appointments-status-filter'>Status</InputLabel>
                    <Select
                        labelId='appointments-status-filter'
                        label='Status'
                        value={status}
                        onChange={e => setStatus(String(e.target.value))}
                    >
                        <MenuItem value=''>All</MenuItem>
                        <MenuItem value='PENDING'>Pending</MenuItem>
                        <MenuItem value='COMPLETED'>Completed</MenuItem>
                        <MenuItem value='RESCHEDULED'>Rescheduled</MenuItem>
                        <MenuItem value='CANCELLED'>Cancelled</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    size='small'
                    label='From'
                    type='date'
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                />

                <TextField
                    size='small'
                    label='To'
                    type='date'
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                />
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    size='small'
                    variant='text'
                    onClick={clearNonOrganizerFilters}
                    disabled={!status && !dateFrom && !dateTo}
                    fullWidth={isMobile}
                >
                    Clear filters
                </Button>
            </Box>
        </Box>
    )

    const listView = isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {loading && appointments.length === 0 ? (
                <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2 }}>
                        <Typography variant='body2' color='text.secondary'>
                            Loading...
                        </Typography>
                    </CardContent>
                </Card>
            ) : appointments.length === 0 ? (
                <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2 }}>
                        <Typography variant='body2' color='text.secondary'>
                            No appointments found
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                leadTreeGroups.flatMap(group => {
                    const renderNode = (node: AppointmentTreeNode, depth: number) => {
                        const a = node.item
                        const sc = statusChip(String(a?.status || 'PENDING'))
                        const organizer = a?.organizerName || a?.organizerEmail || 'Unassigned'
                        const caseTitle = formatLeadGroupHeading(a?.leadTitle, a?.customerName)
                        const descendants = depth === 0 ? getSortedDescendants(node) : []
                        const hasChildren = depth === 0 && descendants.length > 0
                        const nodeCollapsed = hasChildren && isNodeCollapsed(String(a.id))

                        return (
                            <Fragment key={String(a?.id || '')}>
                                <Card
                                    onClick={() => openDetails(String(a.id), 'details')}
                                    sx={{
                                        borderRadius: 3,
                                        border: '1px solid',
                                        borderColor: isHighlighted(String(a?.id || ''))
                                            ? 'rgb(var(--mui-palette-success-mainChannel) / 0.4)'
                                            : 'divider',
                                        backgroundColor: isHighlighted(String(a?.id || ''))
                                            ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                            : 'background.paper',
                                        boxShadow: isHighlighted(String(a?.id || '')) ? '0 12px 30px rgb(0 0 0 / 0.12)' : 'none',
                                        cursor: 'pointer',
                                        ml: depth * 1.25
                                    }}
                                >
                                    <CardContent sx={{ p: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                                    <Box sx={{ width: 30, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                                        {hasChildren ? (
                                                            <IconButton
                                                                size='small'
                                                                onClick={e => {
                                                                    e.stopPropagation()
                                                                    toggleNode(String(a.id))
                                                                }}
                                                            >
                                                                <i className={nodeCollapsed ? 'ri-add-line' : 'ri-subtract-line'} />
                                                            </IconButton>
                                                        ) : null}
                                                    </Box>
                                                    {depth > 0 ? <i className='ri-corner-down-right-line' /> : null}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flex: 1 }}>
                                                        <Typography
                                                            variant='body2'
                                                            sx={{ fontWeight: 800, minWidth: 0, flex: 1 }}
                                                            noWrap
                                                            title={depth === 0 ? caseTitle : a?.customerName || ''}
                                                        >
                                                            {depth === 0 ? caseTitle : a?.customerName || 'Customer'}
                                                        </Typography>
                                                        {depth === 0 && a?.leadId ? (
                                                            <Tooltip title='View case'>
                                                                <IconButton
                                                                    size='small'
                                                                    component={Link}
                                                                    href={`/loan-cases/${encodeURIComponent(String(a.leadId))}`}
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <i className='ri-external-link-line' />
                                                                </IconButton>
                                                            </Tooltip>
                                                        ) : null}
                                                    </Box>
                                                </Box>
                                                {depth > 0 ? (
                                                    <Typography variant='caption' color='text.secondary' noWrap title={a?.leadTitle || ''}>
                                                        {a?.leadTitle || ''}
                                                    </Typography>
                                                ) : null}
                                                <Typography variant='body2' sx={{ mt: 0.75 }}>
                                                    {formatDateTime(a?.scheduledAt || null)}
                                                </Typography>
                                                <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                                                    Organizer: {organizer}
                                                </Typography>
                                            </Box>
                                            <Chip size='small' label={sc.label} color={sc.color} variant='outlined' />
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                                            {canAddFollowUp(a) ? (
                                                <Tooltip title='Add follow-up'>
                                                    <IconButton
                                                        size='small'
                                                        color='primary'
                                                        onClick={e => {
                                                            e.stopPropagation()
                                                            openDetails(String(a.id), 'followup')
                                                        }}
                                                    >
                                                        <i className='ri-add-circle-line' />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : null}
                                        </Box>
                                    </CardContent>
                                </Card>
                                {hasChildren && !nodeCollapsed ? descendants.map(child => renderNode(child, 1)) : null}
                            </Fragment>
                        )
                    }

                    return group.roots.map(node => renderNode(node, 0))
                })
            )}
        </Box>
    ) : (
        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 0 }}>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>Appointment</TableCell>
                            <TableCell>Date/Time</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Organizer</TableCell>
                            <TableCell align='right'>Follow-up</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && appointments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                                        Loading...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : appointments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5}>
                                    <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                                        No appointments found
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            leadTreeGroups.flatMap(group => {
                                const rows = group.roots.flatMap(root => {
                                    const descendants = getSortedDescendants(root)
                                    const rootId = String(root.item.id)
                                    const showChildren = descendants.length > 0 && !isNodeCollapsed(rootId)

                                    return [{ node: root, depth: 0 }, ...(showChildren ? descendants.map(node => ({ node, depth: 1 })) : [])]
                                })

                                return rows.map(({ node, depth }) => {
                                    const a = node.item
                                    const sc = statusChip(String(a?.status || 'PENDING'))
                                    const organizer = a?.organizerName || a?.organizerEmail || 'Unassigned'
                                    const caseTitle = formatLeadGroupHeading(a?.leadTitle, a?.customerName)
                                    const hasChildren = depth === 0 && getSortedDescendants(node).length > 0
                                    const nodeCollapsed = hasChildren && isNodeCollapsed(String(a.id))

                                    return (
                                        <TableRow
                                            key={String(a?.id || '')}
                                            hover
                                            onClick={() => openDetails(String(a.id), 'details')}
                                            sx={{
                                                cursor: 'pointer',
                                                backgroundColor: isHighlighted(String(a?.id || ''))
                                                    ? 'rgb(var(--mui-palette-success-mainChannel) / 0.08)'
                                                    : 'transparent'
                                            }}
                                        >
                                            <TableCell sx={{ maxWidth: 320 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', pl: depth * 2, gap: 0.75 }}>
                                                    <Box sx={{ width: 30, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                                        {hasChildren ? (
                                                            <IconButton
                                                                size='small'
                                                                onClick={e => {
                                                                    e.stopPropagation()
                                                                    toggleNode(String(a.id))
                                                                }}
                                                            >
                                                                <i className={nodeCollapsed ? 'ri-add-line' : 'ri-subtract-line'} />
                                                            </IconButton>
                                                        ) : null}
                                                    </Box>
                                                    {depth > 0 ? <i className='ri-corner-down-right-line' /> : null}
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                                                            <Typography
                                                                variant='body2'
                                                                sx={{ fontWeight: 700, minWidth: 0 }}
                                                                noWrap
                                                                title={depth === 0 ? caseTitle : a?.customerName || ''}
                                                            >
                                                                {depth === 0 ? caseTitle : a?.customerName || '-'}
                                                            </Typography>
                                                            {depth === 0 && a?.leadId ? (
                                                                <Tooltip title='View case'>
                                                                    <IconButton
                                                                        size='small'
                                                                        component={Link}
                                                                        href={`/loan-cases/${encodeURIComponent(String(a.leadId))}`}
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        <i className='ri-external-link-line' />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            ) : null}
                                                        </Box>
                                                        {depth > 0 ? (
                                                            <Typography variant='caption' color='text.secondary' noWrap title={a?.leadTitle || ''}>
                                                                {a?.leadTitle || 'Lead'}
                                                            </Typography>
                                                        ) : null}
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>{formatDateTime(a?.scheduledAt || null)}</TableCell>
                                            <TableCell>
                                                <Chip size='small' label={sc.label} color={sc.color} variant='outlined' />
                                            </TableCell>
                                            <TableCell sx={{ maxWidth: 220 }}>
                                                <Typography variant='body2' noWrap title={organizer}>
                                                    {organizer}
                                                </Typography>
                                                <Typography variant='caption' color='text.secondary' noWrap title={a?.organizerEmail || ''}>
                                                    {a?.organizerEmail || ''}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align='right'>
                                                {canAddFollowUp(a) ? (
                                                    <Tooltip title='Add follow-up'>
                                                        <IconButton
                                                            size='small'
                                                            color='primary'
                                                            onClick={e => {
                                                                e.stopPropagation()
                                                                openDetails(String(a.id), 'followup')
                                                            }}
                                                        >
                                                            <i className='ri-add-circle-line' />
                                                        </IconButton>
                                                    </Tooltip>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            })
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )

    const kanbanView = (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                gap: 2
            }}
        >
            {(['PENDING', 'COMPLETED', 'RESCHEDULED', 'CANCELLED'] as const).map(col => (
                <Card
                    key={col}
                    sx={{
                        borderRadius: 3,
                        boxShadow: 'none',
                        border: '1px solid',
                        borderColor: 'divider',
                        backgroundColor: 'background.paper'
                    }}
                >
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                            <Typography variant='subtitle2' sx={{ fontWeight: 800 }}>
                                {statusChip(col).label}
                            </Typography>
                            <Chip size='small' label={String(grouped[col]?.length || 0)} variant='outlined' />
                        </Box>
                        <Divider sx={{ my: 1.5 }} />
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                            {(grouped[col] || []).length === 0 ? (
                                <Typography variant='body2' color='text.secondary'>
                                    No items
                                </Typography>
                            ) : (
                                (grouped[col] || []).map(a => (
                                    <Box
                                        key={String(a?.id || '')}
                                        onClick={() => openDetails(String(a.id), 'details')}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            px: 1.5,
                                            py: 1.25,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Typography variant='body2' sx={{ fontWeight: 800 }} noWrap title={a?.customerName || ''}>
                                            {a?.customerName || 'Customer'}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary' noWrap title={a?.leadTitle || ''}>
                                            {a?.leadTitle || ''}
                                        </Typography>
                                        <Typography variant='body2' sx={{ mt: 0.75 }}>
                                            {formatDateTime(a?.scheduledAt || null)}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary' noWrap sx={{ display: 'block', mt: 0.5 }}>
                                            Organizer: {a?.organizerName || a?.organizerEmail || 'Unassigned'}
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', mt: 1 }}>
                                            {canAddFollowUp(a) ? (
                                                <Tooltip title='Add follow-up'>
                                                    <IconButton
                                                        size='small'
                                                        color='primary'
                                                        onClick={e => {
                                                            e.stopPropagation()
                                                            openDetails(String(a.id), 'followup')
                                                        }}
                                                    >
                                                        <i className='ri-add-circle-line' />
                                                    </IconButton>
                                                </Tooltip>
                                            ) : null}
                                        </Box>
                                    </Box>
                                ))
                            )}
                        </Box>
                    </CardContent>
                </Card>
            ))}
        </Box>
    )

    return (
        <Box className='flex flex-col gap-4' sx={{ mx: embedded ? 0 : { xs: -2, sm: 0 } }}>
            {embedded ? null : header}
            {embedded ? null : filters}
            {error ? (
                <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 2 }}>
                        <Typography variant='body2' color='error'>
                            {error}
                        </Typography>
                    </CardContent>
                </Card>
            ) : null}
            {view === 'kanban' ? kanbanView : listView}
            <AppointmentDetailsDialog
                open={detailsOpen}
                appointmentId={selectedId}
                initialTab={detailsTab}
                onClose={closeDetails}
                onUpdated={handleUpdated}
            />
        </Box>
    )
}
