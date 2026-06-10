'use client'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import MuiLink from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import type { ReportQueryResponse } from '../reports.types'
import { formatDate, formatINR } from '../utils/exportReport'

type Props = {
  data: ReportQueryResponse
}

export default function ReportsTableSection({ data }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isHistorical = data.dataMode === 'historical'

  if (data.details.length === 0 || data.view === 'summary' || data.view === 'trend') return null

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography variant='h6'>
          Detailed rows
          {data.details.length >= 500 ? (
            <Typography component='span' variant='body2' color='text.secondary' sx={{ ml: 1 }}>
              (showing first 500)
            </Typography>
          ) : null}
        </Typography>
        {data.details.map(row => (
          <Card key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} variant='outlined'>
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'flex-start' }}>
                <Typography fontWeight={700}>{row.customerName ?? 'Unknown customer'}</Typography>
                <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} underline='hover' variant='body2'>
                  View
                </MuiLink>
              </Box>
              <Typography variant='body2' color='text.secondary'>
                {row.loanTypeName ?? '—'} {row.bankName ? `• ${row.bankName}` : ''}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                <Chip
                  size='small'
                  label={isHistorical ? row.auditStageName ?? row.stageName ?? 'Stage' : row.stageName ?? 'Stage'}
                  color={isHistorical ? 'warning' : 'default'}
                  variant='outlined'
                />
                {row.agentName ? <Chip size='small' label={row.agentName} variant='outlined' /> : null}
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography fontWeight={600}>{formatINR(row.requestedAmount)}</Typography>
                <Typography variant='caption' color='text.secondary'>
                  {isHistorical ? `Staged ${row.auditStagedDate ?? '—'}` : formatDate(row.createdAt)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>
    )
  }

  return (
    <Card variant='outlined'>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant='h6' sx={{ mb: 2 }}>
          Detailed rows
          {data.details.length >= 500 ? (
            <Typography component='span' variant='body2' color='text.secondary' sx={{ ml: 1 }}>
              (showing first 500)
            </Typography>
          ) : null}
        </Typography>
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell>Loan type</TableCell>
                <TableCell>Bank</TableCell>
                <TableCell>{isHistorical ? 'Stage (audit)' : 'Stage'}</TableCell>
                {isHistorical ? <TableCell>Staged date</TableCell> : null}
                <TableCell>Agent</TableCell>
                <TableCell align='right'>Amount</TableCell>
                {!isHistorical ? <TableCell>Created</TableCell> : null}
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.details.map(row => (
                <TableRow key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} hover>
                  <TableCell>{row.customerName ?? '—'}</TableCell>
                  <TableCell>{row.loanTypeName ?? '—'}</TableCell>
                  <TableCell>{row.bankName ?? '—'}</TableCell>
                  <TableCell>
                    {isHistorical ? (
                      <Chip size='small' color='warning' variant='outlined' label={row.auditStageName ?? row.stageName ?? '—'} />
                    ) : (
                      row.stageName ?? '—'
                    )}
                  </TableCell>
                  {isHistorical ? <TableCell>{row.auditStagedDate ?? '—'}</TableCell> : null}
                  <TableCell>{row.agentName ?? '—'}</TableCell>
                  <TableCell align='right'>{formatINR(row.requestedAmount)}</TableCell>
                  {!isHistorical ? <TableCell>{formatDate(row.createdAt)}</TableCell> : null}
                  <TableCell align='right'>
                    <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} underline='hover'>
                      Open
                    </MuiLink>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}
