'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

import AppointmentDetailsDialog from '@features/appointments/components/AppointmentDetailsDialog'
import { listAppointments, listAppointmentsByLead } from '@features/appointments/services/appointments'
import { getTenantUsers } from '@features/appointments/services/tenantUsersService'
import type { AppointmentStatus } from '@features/appointments/appointments.types'

type Props = {
    leadId?: string
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

    if (s === 'COMPLETED') return { label: 'COMPLETED', color: 'success' as const }
    if (s === 'CANCELLED') return { label: 'CANCELLED', color: 'error' as const }
    if (s === 'RESCHEDULED') return { label: 'RESCHEDULED', color: 'warning' as const }
    if (s === 'NO_SHOW') return { label: 'NO_SHOW', color: 'default' as const }

    return { label: 'PENDING', color: 'info' as const }
}

function truncate(v: string, n: number) {
    const s = String(v || '')

    if (s.length <= n) return s

    return s.slice(0, n).trimEnd() + '…'
}

export default function LeadAppointmentsDashboard({ leadId }: Props) {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [appointments, setAppointments] = useState<any[]>([])

    const [view, setView] = useState<'list' | 'kanban'>('list')

    const [status, setStatus] = useState<string>('')
    const [assignedTo, setAssignedTo] = useState<string>('')
    const [dateFrom, setDateFrom] = useState<string>('')
    const [dateTo, setDateTo] = useState<string>('')

    const [users, setUsers] = useState<Array<{ id: string; name: string; email: string | null }>>([])

    const [detailsOpen, setDetailsOpen] = useState(false)
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [detailsTab, setDetailsTab] = useState<'details' | 'followup'>('details')

    const refresh = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const baseParams = {
                status: (status || undefined) as AppointmentStatus | undefined,
                assignedTo: assignedTo || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined
            }

            const rows = leadId ? await listAppointmentsByLead(leadId, baseParams) : await listAppointments(baseParams)

            setAppointments(rows as any[])
        } catch (e: any) {
            setAppointments([])
            setError(e?.message || 'Failed to load appointments')
        } finally {
            setLoading(false)
        }
    }, [leadId, status, assignedTo, dateFrom, dateTo])

    useEffect(() => {
        void refresh()
    }, [refresh])

    useEffect(() => {
        let active = true

        void (async () => {
            try {
                const u = await getTenantUsers()

                if (!active) return
                setUsers(u)
            } catch {
                if (!active) return
                setUsers([])
            }
        })()

        return () => {
            active = false
        }
    }, [])

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

    const openDetails = (id: string, tab: 'details' | 'followup') => {
        setSelectedId(id)
        setDetailsTab(tab)
        setDetailsOpen(true)
    }

    const closeDetails = () => {
        setDetailsOpen(false)
        setSelectedId(null)
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
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(4, 1fr)' },
                gap: 2
            }}
        >
            <FormControl size='small' fullWidth>
                <InputLabel id='appointments-status-filter'>Status</InputLabel>
                <Select
                    labelId='appointments-status-filter'
                    label='Status'
                    value={status}
                    onChange={e => setStatus(String(e.target.value))}
                >
                    <MenuItem value=''>All</MenuItem>
                    <MenuItem value='PENDING'>PENDING</MenuItem>
                    <MenuItem value='COMPLETED'>COMPLETED</MenuItem>
                    <MenuItem value='RESCHEDULED'>RESCHEDULED</MenuItem>
                    <MenuItem value='CANCELLED'>CANCELLED</MenuItem>
                </Select>
            </FormControl>

            <FormControl size='small' fullWidth>
                <InputLabel id='appointments-agent-filter'>Assigned Agent</InputLabel>
                <Select
                    labelId='appointments-agent-filter'
                    label='Assigned Agent'
                    value={assignedTo}
                    onChange={e => setAssignedTo(String(e.target.value))}
                >
                    <MenuItem value=''>All</MenuItem>
                    {users.map(u => (
                        <MenuItem key={u.id} value={u.id}>
                            {u.name || u.email || u.id}
                        </MenuItem>
                    ))}
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
                appointments.map(a => {
                    const sc = statusChip(String(a?.status || 'PENDING'))

                    return (
                        <Card
                            key={String(a?.id || '')}
                            sx={{
                                borderRadius: 3,
                                boxShadow: 'none',
                                border: '1px solid',
                                borderColor: 'divider',
                                backgroundColor: 'background.paper'
                            }}
                        >
                            <CardContent sx={{ p: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography variant='body2' sx={{ fontWeight: 800 }} noWrap title={a?.customerName || ''}>
                                            {a?.customerName || 'Customer'}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary' noWrap title={a?.leadTitle || ''}>
                                            {a?.leadTitle || ''}
                                        </Typography>
                                        <Typography variant='body2' sx={{ mt: 0.75 }}>
                                            {formatDateTime(a?.scheduledAt || null)}
                                        </Typography>
                                        <Typography variant='caption' color='text.secondary'>
                                            {a?.followUpType || ''} • {a?.assignedAgentName || a?.assignedAgentEmail || ''}
                                        </Typography>
                                    </Box>
                                    <Chip size='small' label={sc.label} color={sc.color} variant='outlined' />
                                </Box>

                                {a?.outcomeComments ? (
                                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                                        {truncate(String(a.outcomeComments), 90)}
                                    </Typography>
                                ) : null}

                                <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                                    <Button size='small' variant='outlined' fullWidth onClick={() => openDetails(String(a.id), 'details')}>
                                        Details
                                    </Button>
                                    <Button size='small' variant='contained' fullWidth onClick={() => openDetails(String(a.id), 'followup')}>
                                        Add Follow-up
                                    </Button>
                                </Box>
                            </CardContent>
                        </Card>
                    )
                })
            )}
        </Box>
    ) : (
        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: 0 }}>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>Outcome</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Lead</TableCell>
                            <TableCell>Customer</TableCell>
                            <TableCell>Date/Time</TableCell>
                            <TableCell>Follow-up Type</TableCell>
                            <TableCell>Assigned Agent</TableCell>
                            <TableCell align='right'>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading && appointments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                                        Loading...
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : appointments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8}>
                                    <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                                        No appointments found
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            appointments.map(a => {
                                const sc = statusChip(String(a?.status || 'PENDING'))

                                return (
                                    <TableRow key={String(a?.id || '')} hover>
                                        <TableCell sx={{ maxWidth: 260 }}>
                                            <Typography variant='body2' color='text.secondary' noWrap title={a?.outcomeComments || ''}>
                                                {a?.outcomeComments ? truncate(String(a.outcomeComments), 70) : '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Chip size='small' label={sc.label} color={sc.color} variant='outlined' />
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 260 }}>
                                            <Typography variant='body2' noWrap title={a?.leadTitle || ''}>
                                                {a?.leadTitle || '-'}
                                            </Typography>
                                            <Typography variant='caption' color='text.secondary' noWrap title={a?.leadId || ''}>
                                                {a?.leadId || ''}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ maxWidth: 220 }}>
                                            <Typography variant='body2' sx={{ fontWeight: 700 }} noWrap title={a?.customerName || ''}>
                                                {a?.customerName || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{formatDateTime(a?.scheduledAt || null)}</TableCell>
                                        <TableCell>{a?.followUpType || '-'}</TableCell>
                                        <TableCell sx={{ maxWidth: 220 }}>
                                            <Typography variant='body2' noWrap title={a?.assignedAgentEmail || ''}>
                                                {a?.assignedAgentName || a?.assignedAgentEmail || '-'}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align='right'>
                                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                                <Button size='small' variant='outlined' onClick={() => openDetails(String(a.id), 'details')}>
                                                    Details
                                                </Button>
                                                <Button size='small' variant='contained' onClick={() => openDetails(String(a.id), 'followup')}>
                                                    Add Follow-up
                                                </Button>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )
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
                                {col}
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
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            px: 1.5,
                                            py: 1.25
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
                                        <Typography variant='caption' color='text.secondary' noWrap>
                                            {a?.followUpType || ''} • {a?.assignedAgentName || a?.assignedAgentEmail || ''}
                                        </Typography>
                                        <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
                                            <Button size='small' variant='outlined' fullWidth onClick={() => openDetails(String(a.id), 'details')}>
                                                Details
                                            </Button>
                                            <Button size='small' variant='contained' fullWidth onClick={() => openDetails(String(a.id), 'followup')}>
                                                Follow-up
                                            </Button>
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
        <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
            {header}
            {filters}
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
                onUpdated={refresh}
            />
        </Box>
    )
}

