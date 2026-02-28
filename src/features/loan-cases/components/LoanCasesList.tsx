'use client'

import { useEffect, useMemo, useState } from 'react'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
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
import { getTenantUsers } from '@features/loan-cases/services/loanCasesService'
import { getLoanStatusPipelineStages } from '@features/loan-status-pipeline/services/loanStatusPipelineService'
import type { TenantUserOption } from '@features/loan-cases/loan-cases.types'

type StageOption = { id: string; name: string; order: number }

const LoanCasesList = () => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [stageId, setStageId] = useState<string>('')
  const [assignedAgentId, setAssignedAgentId] = useState<string>('')
  const [stages, setStages] = useState<StageOption[]>([])
  const [users, setUsers] = useState<TenantUserOption[]>([])

  const filters = useMemo(
    () => ({
      stageId: stageId || undefined,
      assignedAgentId: assignedAgentId || undefined
    }),
    [stageId, assignedAgentId]
  )

  const { cases, loading } = useLoanCases(filters)

  const stageOptions = useMemo(() => stages.slice().sort((a, b) => (a.order || 0) - (b.order || 0)), [stages])
  const userOptions = useMemo(() => users.slice().sort((a, b) => a.name.localeCompare(b.name)), [users])

  useEffect(() => {

    void (async () => {
      try {
        const [stagesData, usersData] = await Promise.all([getLoanStatusPipelineStages(), getTenantUsers()])

        setStages(stagesData as any)
        setUsers(usersData as any)
      } catch {
      }
    })()
  }, [])

  const formatINR = (v: number) => `₹ ${new Intl.NumberFormat('en-IN').format(v)}`

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
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2
        }}
      >
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
          <InputLabel id='loan-cases-agent-filter'>Assigned Agent</InputLabel>
          <Select
            labelId='loan-cases-agent-filter'
            label='Assigned Agent'
            value={assignedAgentId}
            onChange={e => {
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
          ) : cases.length === 0 ? (
            <Card sx={{ borderRadius: 3, boxShadow: 'none', border: '1px solid', borderColor: 'divider' }}>
              <CardContent sx={{ p: 2 }}>
                <Typography variant='body2' color='text.secondary'>
                  No cases found
                </Typography>
              </CardContent>
            </Card>
          ) : (
            cases.map(c => (
              <Card
                key={c.id}
                sx={{
                  borderRadius: 3,
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'background.paper'
                }}
              >
                <CardContent sx={{ p: 2 }}>
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
                          '&:hover': { color: 'primary.main' }
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
                  <TableCell>Customer</TableCell>
                  <TableCell>Loan Type</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell align='right'>Requested</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell>Assigned Agent</TableCell>
                  <TableCell>Last Updated</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant='body2' color='text.secondary' sx={{ py: 2 }}>
                        Loading...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : cases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant='body2' color='text.secondary' sx={{ py: 2 }}>
                        No cases found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  cases.map(c => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <MuiLink component={Link} href={`/loan-cases/${c.id}`} underline='hover' sx={{ fontWeight: 700 }}>
                          {c.customerName || 'Customer'}
                        </MuiLink>
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
