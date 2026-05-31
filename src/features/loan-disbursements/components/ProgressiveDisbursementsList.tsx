'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { useSession } from 'next-auth/react'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import LinearProgress from '@mui/material/LinearProgress'
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
import MuiLink from '@mui/material/Link'

import type {
  DisbursementStatus,
  DisbursementTrackerListItem
} from '@features/loan-disbursements/loan-disbursements.types'
import { useLoanDisbursements } from '@features/loan-disbursements/hooks/useLoanDisbursements'
import StartDisbursementDialog from '@features/loan-disbursements/components/StartDisbursementDialog'
import { getTenantUsers } from '@features/loan-cases/services/loanCasesService'
import type { TenantUserOption } from '@features/loan-cases/loan-cases.types'

const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

function statusChip(status: DisbursementStatus) {
  switch (status) {
    case 'COMPLETED':
      return { label: 'Completed', color: 'success' as const }
    case 'PARTIAL':
      return { label: 'Partial', color: 'warning' as const }
    default:
      return { label: 'Pending', color: 'default' as const }
  }
}

const summaryCards = [
  { key: 'total', label: 'Active trackers', icon: 'ri-file-list-3-line', color: 'primary.main' },
  { key: 'pending', label: 'Pending', icon: 'ri-time-line', color: 'text.secondary' },
  { key: 'partial', label: 'In progress', icon: 'ri-pie-chart-2-line', color: 'warning.main' },
  { key: 'completed', label: 'Completed', icon: 'ri-checkbox-circle-line', color: 'success.main' }
] as const

const mobileCardSx = {
  borderRadius: 3,
  boxShadow: 'none',
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.paper'
} as const

function customerInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('')
}

function DisbursementTrackerMobileCard({ row }: { row: DisbursementTrackerListItem }) {
  const chip = statusChip(row.disbursementStatus)

  return (
    <Card sx={mobileCardSx}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Avatar
            sx={{
              width: 40,
              height: 40,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              fontSize: '0.85rem',
              fontWeight: 600
            }}
            aria-label={`${row.customerName} avatar`}
          >
            {customerInitials(row.customerName)}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              variant='subtitle1'
              fontWeight={600}
              sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              {row.customerName}
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {row.loanTypeName}
            </Typography>
            <Typography variant='caption' color='text.secondary'>
              {row.stageName}
              {row.bankName ? ` · ${row.bankName}` : ''}
            </Typography>
          </Box>
          <Chip size='small' label={chip.label} color={chip.color} variant='outlined' sx={{ flexShrink: 0 }} />
        </Box>

        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
            <Typography variant='caption' color='text.secondary' fontWeight={600}>
              Progress
            </Typography>
            <Typography variant='caption' fontWeight={700} color='primary.main'>
              {row.progressPercent}%
            </Typography>
          </Box>
          <LinearProgress
            variant='determinate'
            value={row.progressPercent}
            sx={{ height: 8, borderRadius: 4, mb: 0.75 }}
            color={row.disbursementStatus === 'COMPLETED' ? 'success' : 'primary'}
          />
          <Typography variant='caption' color='text.secondary'>
            {formatINR(row.totalDisbursedAmount)} of {formatINR(row.approvedAmount)}
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 1.5,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            mb: 1.5
          }}
        >
          <Box>
            <Typography variant='caption' color='text.secondary' display='block'>
              Disbursed
            </Typography>
            <Typography variant='body2' fontWeight={600} color='success.main'>
              {formatINR(row.totalDisbursedAmount)}
            </Typography>
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant='caption' color='text.secondary' display='block'>
              Remaining
            </Typography>
            <Typography variant='body2' fontWeight={600}>
              {formatINR(row.remainingAmount)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
          <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} variant='body2' underline='hover'>
            View lead
          </MuiLink>
          <Button
            component={Link}
            href={`/progressive-disbursements/${row.id}`}
            size='small'
            variant='contained'
            endIcon={<i className='ri-arrow-right-s-line' />}
          >
            Manage
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export default function ProgressiveDisbursementsList() {
  const { data: session } = useSession()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const sessionUserId = String((session as { userId?: string })?.userId || '')
  const [tenantRole, setTenantRole] = useState<'OWNER' | 'ADMIN' | 'USER' | undefined>(undefined)
  const isUserRole = tenantRole === 'USER'
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')
  const [hasAgentFilterOverride, setHasAgentFilterOverride] = useState(false)
  const [users, setUsers] = useState<TenantUserOption[]>([])
  const [startOpen, setStartOpen] = useState(false)

  const effectiveAssignedAgentId = isUserRole ? undefined : assignedAgentId || undefined

  const { trackers, summary, loading, error, refresh } = useLoanDisbursements({
    statusFilter: statusFilter || undefined,
    assignedAgentId: effectiveAssignedAgentId
  })

  const userOptions = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users])

  useEffect(() => {
    void (async () => {
      try {
        const [usersData, tenantRes] = await Promise.all([
          getTenantUsers(),
          fetch('/api/session/tenant', { cache: 'no-store' })
        ])
        const tenantData = await tenantRes.json().catch(() => ({}))

        setUsers(Array.isArray(usersData) ? usersData : [])
        setTenantRole(
          typeof tenantData?.role === 'string' ? (tenantData.role as 'OWNER' | 'ADMIN' | 'USER') : undefined
        )
      } catch {
      }
    })()
  }, [])

  useEffect(() => {
    if (!sessionUserId) return

    if (isUserRole) {
      if (assignedAgentId === sessionUserId) return
      setAssignedAgentId(sessionUserId)

      return
    }

    if (hasAgentFilterOverride) return
    if (assignedAgentId) return
    if (!userOptions.some(u => u.id === sessionUserId)) return

    setAssignedAgentId(sessionUserId)
  }, [assignedAgentId, hasAgentFilterOverride, isUserRole, sessionUserId, userOptions])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()

    if (!q) return trackers

    return trackers.filter(
      t =>
        t.customerName.toLowerCase().includes(q) ||
        t.loanTypeName.toLowerCase().includes(q) ||
        (t.bankName || '').toLowerCase().includes(q)
    )
  }, [trackers, search])

  return (
    <Box className='flex flex-col gap-4' sx={{ mx: { xs: -2, sm: 0 } }}>
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
          <Typography variant='h5'>Progressive Disbursements</Typography>
          <Typography variant='body2' color='text.secondary'>
            Track staged loan payouts for leads with progressive payment enabled
          </Typography>
        </Box>
        <Button
          variant='contained'
          startIcon={<i className='ri-add-line' />}
          onClick={() => setStartOpen(true)}
          fullWidth={isMobile}
        >
          Start tracking
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 2
        }}
      >
        {summaryCards.map(card => (
          <Card key={card.key} variant='outlined' sx={{ borderRadius: 2 }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    bgcolor: 'action.hover',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: card.color
                  }}
                >
                  <i className={card.icon} />
                </Box>
                <Typography variant='caption' color='text.secondary'>
                  {card.label}
                </Typography>
              </Box>
              <Typography variant='h5'>
                {card.key === 'total' ? summary.total : (summary as Record<string, number>)[card.key]}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card variant='outlined' sx={{ borderRadius: 2, bgcolor: 'primary.50', borderColor: 'primary.light' }}>
        <CardContent sx={{ py: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant='subtitle2' color='primary.dark'>
              Total disbursed (all trackers)
            </Typography>
            <Typography variant='h4' color='primary.main'>
              {formatINR(summary.totalDisbursed)}
            </Typography>
          </Box>
          <Typography variant='body2' color='text.secondary' sx={{ maxWidth: 360 }}>
            Amounts update automatically after each disbursement entry. Over-disbursement is blocked at the API.
          </Typography>
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 200px', md: '1fr 200px 200px' },
          gap: 2
        }}
      >
        <TextField
          size='small'
          placeholder='Search customer or loan type…'
          value={search}
          onChange={e => setSearch(e.target.value)}
          fullWidth
        />
        <FormControl size='small' fullWidth>
          <InputLabel id='disbursements-agent-filter'>Assigned Agent</InputLabel>
          <Select
            labelId='disbursements-agent-filter'
            label='Assigned Agent'
            value={assignedAgentId}
            disabled={isUserRole}
            onChange={e => {
              setHasAgentFilterOverride(true)
              setAssignedAgentId(String(e.target.value))
            }}
          >
            {!isUserRole ? <MenuItem value=''>All Agents</MenuItem> : null}
            {userOptions.map(u => (
              <MenuItem key={u.id} value={u.id}>
                {u.name || u.email || u.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size='small' fullWidth>
          <InputLabel>Status</InputLabel>
          <Select label='Status' value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value=''>All</MenuItem>
            <MenuItem value='PENDING'>Pending</MenuItem>
            <MenuItem value='PARTIAL'>Partial</MenuItem>
            <MenuItem value='COMPLETED'>Completed</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {error ? (
        <Typography color='error' variant='body2'>
          {error}
        </Typography>
      ) : null}

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading ? (
            <Card sx={mobileCardSx}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  Loading…
                </Typography>
              </CardContent>
            </Card>
          ) : filtered.length === 0 ? (
            <Card sx={mobileCardSx}>
              <CardContent sx={{ py: 4, textAlign: 'center' }}>
                <Typography variant='body1' gutterBottom>
                  No disbursement trackers yet
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                  Start tracking from an eligible lead in Lead Manager.
                </Typography>
                <Button variant='outlined' onClick={() => setStartOpen(true)}>
                  Start tracking
                </Button>
              </CardContent>
            </Card>
          ) : (
            filtered.map(row => <DisbursementTrackerMobileCard key={row.id} row={row} />)
          )}
        </Box>
      ) : (
        <Card variant='outlined' sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size='medium'>
              <TableHead>
                <TableRow>
                  <TableCell>Customer</TableCell>
                  <TableCell>Loan</TableCell>
                  <TableCell>Progress</TableCell>
                  <TableCell align='right'>Disbursed</TableCell>
                  <TableCell align='right'>Remaining</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant='body2' color='text.secondary' sx={{ py: 3, textAlign: 'center' }}>
                        Loading…
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Box sx={{ py: 5, textAlign: 'center' }}>
                        <Typography variant='body1' gutterBottom>
                          No disbursement trackers yet
                        </Typography>
                        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                          Start tracking from an eligible lead in Lead Manager.
                        </Typography>
                        <Button variant='outlined' onClick={() => setStartOpen(true)}>
                          Start tracking
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(row => {
                    const chip = statusChip(row.disbursementStatus)

                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Typography variant='body2' fontWeight={600}>
                            {row.customerName}
                          </Typography>
                          <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} variant='caption'>
                            View lead
                          </MuiLink>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{row.loanTypeName}</Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {row.stageName}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ minWidth: 160 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant='determinate'
                              value={row.progressPercent}
                              sx={{ flex: 1, height: 8, borderRadius: 4 }}
                              color={row.disbursementStatus === 'COMPLETED' ? 'success' : 'primary'}
                            />
                            <Typography variant='caption' sx={{ minWidth: 36 }}>
                              {row.progressPercent}%
                            </Typography>
                          </Box>
                          <Typography variant='caption' color='text.secondary'>
                            {formatINR(row.totalDisbursedAmount)} of {formatINR(row.approvedAmount)}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>{formatINR(row.totalDisbursedAmount)}</TableCell>
                        <TableCell align='right'>{formatINR(row.remainingAmount)}</TableCell>
                        <TableCell>
                          <Chip size='small' label={chip.label} color={chip.color} variant='outlined' />
                        </TableCell>
                        <TableCell align='right'>
                          <Button component={Link} href={`/progressive-disbursements/${row.id}`} size='small' variant='outlined'>
                            Manage
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </Box>
        </Card>
      )}

      <StartDisbursementDialog open={startOpen} onClose={() => setStartOpen(false)} onCreated={() => void refresh()} />
    </Box>
  )
}
