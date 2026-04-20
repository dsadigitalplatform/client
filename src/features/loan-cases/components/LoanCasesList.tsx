'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import { useSession } from 'next-auth/react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'
import MuiLink from '@mui/material/Link'

import { useLoanCases } from '@features/loan-cases/hooks/useLoanCases'
import { getLoanCaseBankNames, getTenantUsers } from '@features/loan-cases/services/loanCasesService'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import type { TenantUserOption } from '@features/loan-cases/loan-cases.types'

type StageOption = { id: string; name: string; order: number }

const LoanCasesList = () => {
  const { data: session } = useSession()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const sessionUserId = String((session as any)?.userId || '')
  const [tenantRole, setTenantRole] = useState<'OWNER' | 'ADMIN' | 'USER' | undefined>(undefined)
  const isUserRole = tenantRole === 'USER'

  const [stageId, setStageId] = useState<string>('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')
  const [bankName, setBankName] = useState<string>('')
  const [sortBy, setSortBy] = useState<string>('updatedAt_desc')
  const [showInactive, setShowInactive] = useState<boolean>(false)
  const [hasAgentFilterOverride, setHasAgentFilterOverride] = useState(false)
  const [stages, setStages] = useState<StageOption[]>([])
  const [users, setUsers] = useState<TenantUserOption[]>([])
  const [bankNames, setBankNames] = useState<string[]>([])
  const effectiveAssignedAgentId = isUserRole ? '' : assignedAgentId
  const defaultAssignedAgentId = sessionUserId || ''

  const filters = useMemo(
    () => ({
      stageId: stageId || undefined,
      assignedAgentId: effectiveAssignedAgentId || undefined,
      bankName: bankName || undefined,
      showInactive: showInactive || undefined
    }),
    [bankName, stageId, effectiveAssignedAgentId, showInactive]
  )

  const { cases, loading } = useLoanCases(filters)
  const sortedCases = useMemo(() => {
    const list = cases.slice()

    const toTimestamp = (value: string | null | undefined) => {
      if (!value) return 0
      const timestamp = new Date(value).getTime()

      return Number.isNaN(timestamp) ? 0 : timestamp
    }

    switch (sortBy) {
      case 'updatedAt_asc':
        return list.sort((a, b) => toTimestamp(a.updatedAt) - toTimestamp(b.updatedAt))
      case 'requestedAmount_desc':
        return list.sort((a, b) => (b.requestedAmount ?? Number.NEGATIVE_INFINITY) - (a.requestedAmount ?? Number.NEGATIVE_INFINITY))
      case 'requestedAmount_asc':
        return list.sort((a, b) => (a.requestedAmount ?? Number.POSITIVE_INFINITY) - (b.requestedAmount ?? Number.POSITIVE_INFINITY))
      case 'customerName_asc':
        return list.sort((a, b) => (a.customerName || '').localeCompare(b.customerName || ''))
      case 'updatedAt_desc':
      default:
        return list.sort((a, b) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
    }
  }, [cases, sortBy])

  const stageOptions = useMemo(() => stages.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [stages])
  const userOptions = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users])

  const hasActiveFilters =
    Boolean(stageId) || Boolean(bankName) || showInactive || assignedAgentId !== defaultAssignedAgentId

  useEffect(() => {

    void (async () => {
      try {
        const [stagesData, usersData, bankNamesData] = await Promise.all([
          getLoanStatusPipelineStages(),
          getTenantUsers(),
          getLoanCaseBankNames()
        ])

        setStages(stagesData as any)
        setUsers(usersData as any)
        setBankNames(Array.isArray(bankNamesData) ? bankNamesData : [])
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

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/session/tenant', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        const role = typeof data?.role === 'string' ? (data.role as 'OWNER' | 'ADMIN' | 'USER') : undefined

        setTenantRole(role)
      } catch {
      }
    })()
  }, [])

  const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`
  const formatListNumber = (index: number) => String(index + 1).padStart(2, '0')

  const formatRemarkDate = (value: string | null | undefined) => {
    if (!value) return '—'
    const date = new Date(value)

    if (Number.isNaN(date.getTime())) return '—'

    return date.toLocaleString()
  }

  const stageChipColor = (name: string) => {
    const n = name.toLowerCase()

    if (n.includes('approved')) return 'success' as const
    if (n.includes('rejected')) return 'error' as const
    if (n.includes('pending')) return 'warning' as const
    if (n.includes('login')) return 'info' as const

    return 'default' as const
  }

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
          <Typography variant='h5'>Lead Manager</Typography>
          <Typography variant='body2' color='text.secondary'>
            Track cases, documents, and assignments
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 1.5,
            alignItems: { sm: 'center' },
            flex: 1,
            justifyContent: 'flex-end'
          }}
        >
          <Button
            component={Link}
            href='/loan-cases/create'
            variant='contained'
            startIcon={<i className='ri-add-line' />}
            fullWidth={isMobile}
          >
            Create Lead
          </Button>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(4, minmax(0, 1fr)) auto auto'
          },
          gap: 2,
          alignItems: 'center'
        }}
      >
        <FormControl size='small' fullWidth>
          <InputLabel id='loan-cases-agent-filter'>Assigned Agent</InputLabel>
          <Select
            labelId='loan-cases-agent-filter'
            label='Assigned Agent'
            value={assignedAgentId}
            disabled={isUserRole}
            onChange={e => {
              setHasAgentFilterOverride(true)
              setAssignedAgentId(String(e.target.value))
            }}
          >
            <MenuItem value=''>All Agents</MenuItem>
            {userOptions.map(u => (
              <MenuItem key={u.id} value={u.id}>
                {u.name || u.email || u.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size='small' fullWidth>
          <InputLabel id='loan-cases-bank-filter'>Bank</InputLabel>
          <Select
            labelId='loan-cases-bank-filter'
            label='Bank'
            value={bankName}
            onChange={e => {
              setBankName(String(e.target.value))
            }}
          >
            <MenuItem value=''>All Banks</MenuItem>
            {bankNames.map(name => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size='small' fullWidth>
          <InputLabel id='loan-cases-stage-filter'>Stage</InputLabel>
          <Select
            labelId='loan-cases-stage-filter'
            label='Stage'
            value={stageId}
            onChange={e => {
              setStageId(String(e.target.value))
            }}
          >
            <MenuItem value=''>All Stages</MenuItem>
            {stageOptions.map(s => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size='small' fullWidth>
          <InputLabel id='loan-cases-sort-by'>Sort by</InputLabel>
          <Select
            labelId='loan-cases-sort-by'
            label='Sort by'
            value={sortBy}
            onChange={e => {
              setSortBy(String(e.target.value))
            }}
          >
            <MenuItem value='updatedAt_desc'>Last Updated (Newest)</MenuItem>
            <MenuItem value='updatedAt_asc'>Last Updated (Oldest)</MenuItem>
            <MenuItem value='requestedAmount_desc'>Requested Amount (High to Low)</MenuItem>
            <MenuItem value='requestedAmount_asc'>Requested Amount (Low to High)</MenuItem>
            <MenuItem value='customerName_asc'>Customer Name (A-Z)</MenuItem>
          </Select>
        </FormControl>


        <FormControlLabel
          control={
            <Switch
              checked={showInactive}
              onChange={e => setShowInactive(e.target.checked)}
              size='small'
            />
          }
          label='Show inactive'
          sx={{ mt: 0, ml: 0, justifyContent: { xs: 'space-between', md: 'flex-start' }, width: { xs: '100%', md: 'auto' } }}
        />
        <Button
          variant='text'
          color='secondary'
          disabled={!hasActiveFilters}
          fullWidth={isMobile}
          sx={{ justifySelf: { md: 'start' } }}
          onClick={() => {
            setStageId('')
            setBankName('')
            setShowInactive(false)
            setHasAgentFilterOverride(false)
            setAssignedAgentId(defaultAssignedAgentId)
          }}
        >
          Clear Filters
        </Button>
      </Box>

      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {loading ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  Loading...
                </Typography>
              </CardContent>
            </Card>
          ) : sortedCases.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No cases found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            sortedCases.map((c, index) => (
              <Card
                key={c.id}
                sx={{
                  borderRadius: 3,
                  boxShadow: c.isActive === false ? '0 6px 20px rgba(244,67,54,0.18)' : 'var(--mui-customShadows-sm)',
                  border: c.isActive === false ? '2px solid' : '1px solid',
                  borderColor: c.isActive === false ? 'error.main' : 'divider',
                  backgroundColor: c.isActive === false ? 'rgba(244,67,54,0.08)' : 'background.paper',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                  opacity: c.isActive === false ? 0.95 : 1,
                  '&::before': c.isActive === false ? {
                    content: '"INACTIVE"',
                    position: 'absolute',
                    top: 10,
                    right: -34,
                    backgroundColor: 'error.main',
                    color: 'white',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '4px 32px',
                    transform: 'rotate(45deg)',
                    letterSpacing: '0.6px',
                    zIndex: 1
                  } : {}
                }}
              >
                <CardContent sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 1 }}>
                    <Chip
                      size='small'
                      label={`#${formatListNumber(index)}`}
                      sx={{
                        height: 24,
                        borderRadius: 1.5,
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        color: 'primary.main',
                        backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)'
                      }}
                    />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <MuiLink
                        component={Link}
                        href={`/loan-cases/${c.id}`}
                        underline='hover'
                        color='text.primary'
                        sx={{
                          fontSize: '1rem',
                          fontWeight: 700,
                          display: 'block',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          transition: 'color .2s ease',
                          color: c.isActive === false ? 'text.secondary' : 'text.primary',
                          '&:hover': { color: c.isActive === false ? 'text.secondary' : 'primary.main' }
                        }}
                      >
                        {c.customerName || 'Customer'}
                      </MuiLink>
                      <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
                        {c.loanTypeName || 'Loan Type'} {c.bankName ? `• ${c.bankName}` : ''}
                      </Typography>
                    </Box>
                    <Chip
                      size='small'
                      label={c.stageName || 'Stage'}
                      color={stageChipColor(c.stageName || '')}
                      variant='outlined'
                      sx={{ height: 24 }}
                    />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, gap: 1.5 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Requested
                    </Typography>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                      {typeof c.requestedAmount === 'number' ? formatINR(c.requestedAmount) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, gap: 1.5 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Assigned
                    </Typography>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                      {c.assignedAgentName || c.assignedAgentEmail || '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75, gap: 1.5 }}>
                    <Typography variant='body2' color='text.secondary'>
                      Updated
                    </Typography>
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                      {c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      ) : (
        <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
          <CardContent sx={{ p: 0 }}>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 60 }}>#</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell>Loan Type</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell align='right'>Requested</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Assigned Agent</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant='body2' color='text.secondary' sx={{ py: 2 }}>
                        Loading...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : sortedCases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9}>
                      <Typography variant='body2' color='text.secondary' sx={{ py: 2 }}>
                        No cases found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCases.map((c, index) => (
                    <TableRow
                      key={c.id}
                      hover
                      sx={{
                        backgroundColor: c.isActive === false ? 'rgba(244,67,54,0.08)' : 'inherit',
                        borderLeft: c.isActive === false ? '6px solid' : 'none',
                        borderLeftColor: c.isActive === false ? 'error.main' : 'none',
                        position: 'relative',
                        '&:hover': {
                          backgroundColor: c.isActive === false ? 'rgba(244,67,54,0.12)' : 'action.hover'
                        },
                        '& td': {
                          color: c.isActive === false ? 'text.secondary' : 'inherit'
                        }
                      }}
                    >
                      <TableCell>
                        <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 600 }}>
                          #{formatListNumber(index)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MuiLink
                            component={Link}
                            href={`/loan-cases/${c.id}`}
                            underline='hover'
                            sx={{
                              fontWeight: 700,
                              color: c.isActive === false ? 'error.main' : 'text.primary',
                              textDecoration: c.isActive === false ? 'line-through' : 'none'
                            }}
                          >
                            {c.customerName || 'Customer'}
                          </MuiLink>

                        </Box>
                      </TableCell>
                      <TableCell>{c.loanTypeName || '—'}</TableCell>
                      <TableCell>{c.bankName || '—'}</TableCell>
                      <TableCell align='right'>
                        {typeof c.requestedAmount === 'number' ? formatINR(c.requestedAmount) : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size='small'
                          label={c.stageName || 'Stage'}
                          color={stageChipColor(c.stageName || '')}
                          variant='outlined'
                        />
                      </TableCell>
                      <TableCell>{c.assignedAgentName || c.assignedAgentEmail || '—'}</TableCell>
                      <TableCell sx={{ minWidth: 280 }}>
                        {c.remarks && c.remarks.length > 0 ? (
                          <Box>
                            <Typography variant='body2' sx={{ fontWeight: 600 }}>
                              {c.remarks[0].text}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {`${c.remarks[0].updatedByName || c.remarks[0].updatedByEmail || 'Unknown'} • ${formatRemarkDate(c.remarks[0].updatedAt)}`}
                            </Typography>
                            {c.remarks.length > 1 ? (
                              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
                                {`${c.remarks.length} remarks`}
                              </Typography>
                            ) : null}
                          </Box>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{c.updatedAt ? new Date(c.updatedAt).toLocaleString() : '—'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

    </Box>
  )
}

export default LoanCasesList
