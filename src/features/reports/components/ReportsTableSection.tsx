'use client'

import Link from 'next/link'
import { Fragment, useMemo, useState, type KeyboardEvent } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import MuiLink from '@mui/material/Link'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'

import type { ReportDetailGroupDimension, ReportDetailRow, ReportQueryResponse } from '../reports.types'
import { buildDetailGroups } from '../utils/buildDetailGroups'
import { formatDate, formatINR, groupByLabel } from '../utils/exportReport'

type Props = {
  data: ReportQueryResponse
  groupBySecondary: ReportDetailGroupDimension | null
}

function groupRowId(level: 'primary' | 'secondary', parentKey: string, key: string) {
  return `${level}:${parentKey}:${key}`
}

function ExpandChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'action.hover',
        color: 'text.secondary',
        flexShrink: 0
      }}
    >
      <i className={collapsed ? 'ri-arrow-right-s-line' : 'ri-arrow-down-s-line'} style={{ fontSize: '1.1rem' }} />
    </Box>
  )
}

function toggleGroupOnKeyDown(event: KeyboardEvent, onToggle: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onToggle()
  }
}

function DetailRowCells({
  row,
  isHistorical,
  indent = 0
}: {
  row: ReportDetailRow
  isHistorical: boolean
  indent?: number
}) {
  return (
    <>
      <TableCell sx={{ pl: 2 + indent * 3 }}>
        <Typography variant='body2'>{row.customerName ?? '—'}</Typography>
      </TableCell>
      <TableCell />
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
      <TableCell align='right'>
        <Typography variant='body2'>{formatINR(row.requestedAmount)}</Typography>
      </TableCell>
      {!isHistorical ? <TableCell>{formatDate(row.createdAt)}</TableCell> : null}
      <TableCell align='right'>
        <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} underline='hover'>
          Open
        </MuiLink>
      </TableCell>
    </>
  )
}

function GroupLevelMarker({ level }: { level: 'primary' | 'secondary' | 'detail' }) {
  const theme = useTheme()

  if (level === 'detail') {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 0.5 }}>
        <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: 'action.disabled' }} />
      </Box>
    )
  }

  const isPrimary = level === 'primary'
  const palette = isPrimary ? theme.palette.primary : theme.palette.secondary

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 0.25 }}>
      <Box
        title={isPrimary ? 'Group total' : 'Subgroup subtotal'}
        sx={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: isPrimary ? palette.main : alpha(palette.main, 0.12),
          color: isPrimary ? palette.contrastText : palette.main,
          border: isPrimary ? 'none' : `1.5px solid ${alpha(palette.main, 0.45)}`,
          boxShadow: isPrimary ? `0 0 0 3px ${alpha(palette.main, 0.18)}` : 'none',
          flexShrink: 0
        }}
      >
        <i className={isPrimary ? 'ri-stack-line' : 'ri-node-tree'} style={{ fontSize: '0.95rem', lineHeight: 1 }} />
      </Box>
    </Box>
  )
}

function GroupAmountCell({ amount, label }: { amount: number; label: string }) {
  return (
    <TableCell align='right' sx={{ whiteSpace: 'nowrap' }}>
      <Typography variant='subtitle2' fontWeight={800} color='inherit'>
        {formatINR(amount)}
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.25 }}>
        {label}
      </Typography>
    </TableCell>
  )
}

function MobileGroupTotals({ count, amount, label, tone }: { count: number; amount: number; label: string; tone: 'primary' | 'secondary' }) {
  const theme = useTheme()
  const accent = tone === 'primary' ? theme.palette.primary : theme.palette.secondary

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 1,
        flexShrink: 0,
        alignItems: 'stretch'
      }}
    >
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderRadius: 1.5,
          bgcolor: alpha(accent.main, 0.12),
          border: 1,
          borderColor: alpha(accent.main, 0.35),
          textAlign: 'center',
          minWidth: 72
        }}
      >
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', lineHeight: 1.2 }}>
          Cases
        </Typography>
        <Typography variant='subtitle2' fontWeight={800}>
          {count}
        </Typography>
      </Box>
      <Box
        sx={{
          px: 1.25,
          py: 0.75,
          borderRadius: 1.5,
          bgcolor: alpha(accent.main, 0.12),
          border: 1,
          borderColor: alpha(accent.main, 0.35),
          textAlign: 'right',
          minWidth: 108
        }}
      >
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography variant='subtitle2' fontWeight={800}>
          {formatINR(amount)}
        </Typography>
      </Box>
    </Box>
  )
}

export default function ReportsTableSection({ data, groupBySecondary }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isHistorical = data.dataMode === 'historical'
  const hasSecondary = Boolean(groupBySecondary && groupBySecondary !== data.groupBy)
  const emptyDetailCols = isHistorical ? 5 : 4

  const groups = useMemo(
    () =>
      buildDetailGroups({
        rows: data.details,
        primary: data.groupBy === 'time' ? 'stage' : data.groupBy,
        secondary: hasSecondary ? groupBySecondary : null,
        isHistorical,
        breakdown: data.breakdown
      }),
    [data.breakdown, data.details, data.groupBy, groupBySecondary, hasSecondary, isHistorical]
  )

  const allGroupIds = useMemo(() => {
    const ids: string[] = []

    groups.forEach(group => {
      ids.push(groupRowId('primary', 'root', group.key))

      group.subgroups.forEach(subgroup => {
        ids.push(groupRowId('secondary', group.key, subgroup.key))
      })
    })

    return ids
  }, [groups])

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const isCollapsed = (id: string) => Boolean(collapsed[id])

  const toggleGroup = (id: string) => {
    setCollapsed(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const expandAll = () => setCollapsed({})

  const collapseAll = () => {
    const next: Record<string, boolean> = {}

    allGroupIds.forEach(id => {
      next[id] = true
    })

    setCollapsed(next)
  }

  if (data.details.length === 0 || data.view === 'summary' || data.view === 'trend') return null

  const groupingLabel = hasSecondary
    ? `${groupByLabel(data.groupBy)} → ${groupByLabel(groupBySecondary!)}`
    : groupByLabel(data.groupBy)

  const primaryStyles = {
    bgcolor: alpha(theme.palette.primary.main, 0.14),
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    '& > td': { borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.25)}` },
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.22) }
  }

  const secondaryStyles = {
    bgcolor: alpha(theme.palette.secondary.main, 0.1),
    borderLeft: `4px solid ${theme.palette.secondary.main}`,
    '& > td': { borderBottom: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}` },
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.18) }
  }

  if (isMobile) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant='h6'>Grouped detail</Typography>
          <Typography variant='body2' color='text.secondary'>
            Nested by {groupingLabel}
            {data.details.length >= 500 ? ' (showing first 500 rows)' : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size='small' variant='outlined' onClick={expandAll}>
              Expand all
            </Button>
            <Button size='small' variant='outlined' onClick={collapseAll}>
              Collapse all
            </Button>
          </Box>
        </Box>

        {groups.map(group => {
          const primaryId = groupRowId('primary', 'root', group.key)
          const primaryCollapsed = isCollapsed(primaryId)

          return (
            <Card
              key={group.key}
              variant='outlined'
              sx={{ overflow: 'hidden', borderColor: alpha(theme.palette.primary.main, 0.35), borderWidth: 2 }}
            >
              <Box
                role='button'
                tabIndex={0}
                aria-expanded={!primaryCollapsed}
                onClick={() => toggleGroup(primaryId)}
                onKeyDown={event => toggleGroupOnKeyDown(event, () => toggleGroup(primaryId))}
                sx={{
                  px: 2,
                  py: 1.5,
                  ...primaryStyles,
                  borderLeft: `5px solid ${theme.palette.primary.main}`
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                    <GroupLevelMarker level='primary' />
                    <ExpandChevron collapsed={primaryCollapsed} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                        {groupByLabel(data.groupBy)}
                      </Typography>
                      <Typography variant='subtitle1' fontWeight={800} noWrap>
                        {group.label}
                      </Typography>
                    </Box>
                  </Box>
                  <MobileGroupTotals count={group.count} amount={group.amount} label='Group total' tone='primary' />
                </Box>
              </Box>

              <Collapse in={!primaryCollapsed}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5 }}>
                  {hasSecondary
                    ? group.subgroups.map(subgroup => {
                        const secondaryId = groupRowId('secondary', group.key, subgroup.key)
                        const secondaryCollapsed = isCollapsed(secondaryId)

                        return (
                          <Box
                            key={subgroup.key}
                            sx={{
                              border: 1,
                              borderColor: alpha(theme.palette.secondary.main, 0.35),
                              borderRadius: 2,
                              overflow: 'hidden',
                              ml: 1
                            }}
                          >
                            <Box
                              role='button'
                              tabIndex={0}
                              aria-expanded={!secondaryCollapsed}
                              onClick={() => toggleGroup(secondaryId)}
                              onKeyDown={event => toggleGroupOnKeyDown(event, () => toggleGroup(secondaryId))}
                              sx={{ px: 1.5, py: 1.25, ...secondaryStyles }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
                                  <GroupLevelMarker level='secondary' />
                                  <ExpandChevron collapsed={secondaryCollapsed} />
                                  <Box sx={{ minWidth: 0 }}>
                                    <Typography variant='caption' color='text.secondary' sx={{ display: 'block' }}>
                                      {groupByLabel(groupBySecondary!)}
                                    </Typography>
                                    <Typography variant='body1' fontWeight={700} noWrap>
                                      {subgroup.label}
                                    </Typography>
                                  </Box>
                                </Box>
                                <MobileGroupTotals count={subgroup.count} amount={subgroup.amount} label='Subtotal' tone='secondary' />
                              </Box>
                            </Box>
                            <Collapse in={!secondaryCollapsed}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1, bgcolor: 'background.default' }}>
                                {subgroup.rows.map(row => (
                                  <Card key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} variant='outlined'>
                                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: '12px !important' }}>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                                        <Typography fontWeight={600}>{row.customerName ?? 'Unknown customer'}</Typography>
                                        <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} underline='hover' variant='body2'>
                                          View
                                        </MuiLink>
                                      </Box>
                                      <Typography variant='body2' color='text.secondary'>
                                        {row.loanTypeName ?? '—'} {row.bankName ? `• ${row.bankName}` : ''}
                                      </Typography>
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
                            </Collapse>
                          </Box>
                        )
                      })
                    : group.rows.map(row => (
                        <Card key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} variant='outlined'>
                          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, py: '12px !important' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                              <Typography fontWeight={600}>{row.customerName ?? 'Unknown customer'}</Typography>
                              <MuiLink component={Link} href={`/loan-cases/${row.leadId}`} underline='hover' variant='body2'>
                                View
                              </MuiLink>
                            </Box>
                            <Typography variant='body2' color='text.secondary'>
                              {row.loanTypeName ?? '—'} {row.bankName ? `• ${row.bankName}` : ''}
                            </Typography>
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
              </Collapse>
            </Card>
          )
        })}
      </Box>
    )
  }

  return (
    <Card variant='outlined'>
      <CardContent sx={{ p: { xs: 2, md: 3 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Box>
            <Typography variant='h6'>Grouped detail</Typography>
            <Typography variant='body2' color='text.secondary'>
              Nested by {groupingLabel}
              {data.details.length >= 500 ? ' (showing first 500 rows)' : ''}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, mt: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <GroupLevelMarker level='primary' />
                <Typography variant='caption' color='text.secondary'>
                  Primary group total
                </Typography>
              </Box>
              {hasSecondary ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <GroupLevelMarker level='secondary' />
                  <Typography variant='caption' color='text.secondary'>
                    Nested subtotal
                  </Typography>
                </Box>
              ) : null}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              size='small'
              label={`${data.summary.totalCases} cases · ${formatINR(data.summary.totalAmount)}`}
              color='default'
              variant='outlined'
            />
            <Button size='small' variant='outlined' onClick={expandAll}>
              Expand all
            </Button>
            <Button size='small' variant='outlined' onClick={collapseAll}>
              Collapse all
            </Button>
          </Box>
        </Box>

        <TableContainer>
          <Table size='small' sx={{ tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 44, px: 0.5, textAlign: 'center' }} aria-label='Row level' />
                <TableCell sx={{ minWidth: 200 }}>{groupByLabel(data.groupBy)} / Customer</TableCell>
                <TableCell align='center' sx={{ width: 72 }}>
                  Cases
                </TableCell>
                <TableCell>Loan type</TableCell>
                <TableCell>Bank</TableCell>
                <TableCell>{isHistorical ? 'Stage (audit)' : 'Stage'}</TableCell>
                {isHistorical ? <TableCell>Staged date</TableCell> : null}
                <TableCell>Agent</TableCell>
                <TableCell align='right' sx={{ width: 140 }}>
                  Amount
                </TableCell>
                {!isHistorical ? <TableCell>Created</TableCell> : null}
                <TableCell sx={{ width: 64 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.map(group => {
                const primaryId = groupRowId('primary', 'root', group.key)
                const primaryCollapsed = isCollapsed(primaryId)

                return (
                  <Fragment key={group.key}>
                    <TableRow
                      sx={primaryStyles}
                      role='button'
                      tabIndex={0}
                      aria-expanded={!primaryCollapsed}
                      onClick={() => toggleGroup(primaryId)}
                      onKeyDown={event => toggleGroupOnKeyDown(event, () => toggleGroup(primaryId))}
                    >
                      <TableCell sx={{ width: 44, px: 0.5, verticalAlign: 'middle' }}>
                        <GroupLevelMarker level='primary' />
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'middle' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <ExpandChevron collapsed={primaryCollapsed} />
                          <Box>
                            <Typography variant='caption' color='text.secondary'>
                              {groupByLabel(data.groupBy)}
                            </Typography>
                            <Typography variant='subtitle1' fontWeight={800}>
                              {group.label}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell align='center'>
                        <Typography variant='subtitle2' fontWeight={800}>
                          {group.count}
                        </Typography>
                      </TableCell>
                      <TableCell colSpan={emptyDetailCols} />
                      <GroupAmountCell amount={group.amount} label='Group total' />
                      {!isHistorical ? <TableCell /> : null}
                      <TableCell />
                    </TableRow>

                    {!primaryCollapsed && hasSecondary
                      ? group.subgroups.map(subgroup => {
                          const secondaryId = groupRowId('secondary', group.key, subgroup.key)
                          const secondaryCollapsed = isCollapsed(secondaryId)

                          return (
                            <Fragment key={`${group.key}-${subgroup.key}`}>
                              <TableRow
                                sx={secondaryStyles}
                                role='button'
                                tabIndex={0}
                                aria-expanded={!secondaryCollapsed}
                                onClick={() => toggleGroup(secondaryId)}
                                onKeyDown={event => toggleGroupOnKeyDown(event, () => toggleGroup(secondaryId))}
                              >
                                <TableCell sx={{ width: 44, px: 0.5, verticalAlign: 'middle' }}>
                                  <GroupLevelMarker level='secondary' />
                                </TableCell>
                                <TableCell sx={{ pl: 5, verticalAlign: 'middle' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                                    <ExpandChevron collapsed={secondaryCollapsed} />
                                    <Box>
                                      <Typography variant='caption' color='text.secondary'>
                                        {groupByLabel(groupBySecondary!)}
                                      </Typography>
                                      <Typography variant='body2' fontWeight={700}>
                                        {subgroup.label}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </TableCell>
                                <TableCell align='center'>
                                  <Typography variant='subtitle2' fontWeight={700} color='secondary.main'>
                                    {subgroup.count}
                                  </Typography>
                                </TableCell>
                                <TableCell colSpan={emptyDetailCols} />
                                <GroupAmountCell amount={subgroup.amount} label='Subtotal' />
                                {!isHistorical ? <TableCell /> : null}
                                <TableCell />
                              </TableRow>

                              {!secondaryCollapsed
                                ? subgroup.rows.map(row => (
                                    <TableRow key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} hover>
                                      <TableCell sx={{ width: 44, px: 0.5, verticalAlign: 'middle' }}>
                                        <GroupLevelMarker level='detail' />
                                      </TableCell>
                                      <DetailRowCells row={row} isHistorical={isHistorical} indent={2} />
                                    </TableRow>
                                  ))
                                : null}
                            </Fragment>
                          )
                        })
                      : null}

                    {!primaryCollapsed && !hasSecondary
                      ? group.rows.map(row => (
                          <TableRow key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} hover>
                            <TableCell sx={{ width: 44, px: 0.5, verticalAlign: 'middle' }}>
                              <GroupLevelMarker level='detail' />
                            </TableCell>
                            <DetailRowCells row={row} isHistorical={isHistorical} indent={1} />
                          </TableRow>
                        ))
                      : null}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  )
}
