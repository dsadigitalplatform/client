'use client'

import Link from 'next/link'
import { Fragment, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import LinearProgress from '@mui/material/LinearProgress'
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

import {
  showsLoanTypeDetailColumn,
  type ReportDetailGroupDimension,
  type ReportDetailRow,
  type ReportQueryResponse
} from '../reports.types'
import { LeadIdentity } from '@features/loan-cases/components/LeadCodeDisplay'
import { buildDetailGroups } from '../utils/buildDetailGroups'
import { formatDate, formatINR, groupByLabel } from '../utils/exportReport'
import {
  disbursementStatusChipColor,
  disbursementStatusLabel,
  hasReportDisbursementData
} from '../utils/reportDisbursement'

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

function DisbursementStatusChip({ row }: { row: ReportDetailRow }) {
  if (row.disbursementStatus == null) return null

  return (
    <Chip
      size='small'
      label={disbursementStatusLabel(row.disbursementStatus)}
      color={disbursementStatusChipColor(row.disbursementStatus)}
      variant='outlined'
      sx={{ height: 22 }}
    />
  )
}

function DisbursementBalanceCell({ row }: { row: ReportDetailRow }) {
  if (row.disbursementStatus == null) return null

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant='body2' fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
        {formatINR(row.remainingAmount)}
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', lineHeight: 1.3 }}>
        remaining
      </Typography>
      <Box sx={{ mt: 0.75, maxWidth: 120 }}>
        <LinearProgress
          variant='determinate'
          value={row.progressPercent ?? 0}
          color={row.disbursementStatus === 'COMPLETED' ? 'success' : 'primary'}
          sx={{ height: 4, borderRadius: 2 }}
        />
        <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.25 }}>
          {formatINR(row.totalDisbursedAmount)} paid
        </Typography>
      </Box>
    </Box>
  )
}

function DetailRowCells({
  row,
  isHistorical,
  showDisbursement,
  showLoanType,
  indent = 0
}: {
  row: ReportDetailRow
  isHistorical: boolean
  showDisbursement: boolean
  showLoanType: boolean
  indent?: number
}) {
  return (
    <>
      <TableCell sx={{ pl: 2 + indent * 3 }}>
        <LeadIdentity customerName={row.customerName ?? '—'} code={row.leadCode} />
      </TableCell>
      {showLoanType ? <TableCell>{row.loanTypeName ?? '—'}</TableCell> : null}
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
      {showDisbursement ? (
        <>
          <TableCell>
            <DisbursementStatusChip row={row} />
          </TableCell>
          <TableCell align='right'>
            <DisbursementBalanceCell row={row} />
          </TableCell>
        </>
      ) : null}
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

function GroupRowBannerCell({
  groupLabel,
  count,
  collapsed,
  tone,
  indent = 0,
  colSpan
}: {
  groupLabel: string
  count: number
  collapsed: boolean
  tone: 'primary' | 'secondary'
  indent?: number
  colSpan: number
}) {
  const theme = useTheme()
  const accent = tone === 'primary' ? theme.palette.primary : theme.palette.secondary
  const caseLabel = count === 1 ? 'case' : 'cases'

  return (
    <TableCell
      colSpan={colSpan}
      sx={{
        verticalAlign: 'middle',
        pl: 2 + indent * 3,
        ...(indent > 0 ? { boxShadow: `inset 3px 0 0 ${alpha(accent.main, 0.45)}` } : {})
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
        <ExpandChevron collapsed={collapsed} />
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Typography
            variant={tone === 'primary' ? 'subtitle1' : 'body1'}
            fontWeight={800}
            color={tone === 'secondary' ? 'secondary.main' : 'text.primary'}
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
              flex: 1
            }}
            title={groupLabel}
          >
            {groupLabel}
          </Typography>
          <Typography variant='body2' color='text.secondary' fontWeight={600} sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
            {count} {caseLabel}
          </Typography>
        </Box>
      </Box>
    </TableCell>
  )
}

function MobileGroupHeader({
  groupLabel,
  count,
  amount,
  collapsed,
  onToggle,
  tone
}: {
  groupLabel: string
  count: number
  amount: number
  collapsed: boolean
  onToggle: () => void
  tone: 'primary' | 'secondary'
}) {
  const theme = useTheme()
  const accent = tone === 'primary' ? theme.palette.primary : theme.palette.secondary
  const caseLabel = count === 1 ? 'case' : 'cases'

  return (
    <Box
      role='button'
      tabIndex={0}
      aria-expanded={!collapsed}
      onClick={onToggle}
      onKeyDown={event => toggleGroupOnKeyDown(event, onToggle)}
      sx={{
        px: 2,
        py: 1.5,
        cursor: 'pointer',
        bgcolor: alpha(accent.main, tone === 'primary' ? 0.1 : 0.06),
        borderLeft: `4px solid ${accent.main}`,
        transition: 'background-color 0.15s ease',
        '&:hover': { bgcolor: alpha(accent.main, tone === 'primary' ? 0.16 : 0.1) }
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, minWidth: 0 }}>
        <ExpandChevron collapsed={collapsed} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant='subtitle1' fontWeight={800} sx={{ wordBreak: 'break-word', lineHeight: 1.3 }}>
            {groupLabel}
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
            {count} {caseLabel} · {formatINR(amount)}
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}

function MobileDetailField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <>
      <Typography variant='caption' color='text.secondary' sx={{ pt: 0.25 }}>
        {label}
      </Typography>
      <Typography variant='body2' sx={{ wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </>
  )
}

function MobileDisbursementBlock({ row }: { row: ReportDetailRow }) {
  if (row.disbursementStatus == null) return null

  return (
    <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography variant='caption' color='text.secondary' fontWeight={600}>
          Disbursement
        </Typography>
        <DisbursementStatusChip row={row} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
        <Box>
          <Typography variant='caption' color='text.secondary' display='block'>
            Balance left
          </Typography>
          <Typography variant='subtitle2' fontWeight={800}>
            {formatINR(row.remainingAmount)}
          </Typography>
        </Box>
        <Typography variant='caption' color='text.secondary' textAlign='right'>
          {formatINR(row.totalDisbursedAmount)} of {formatINR(row.trackerApprovedAmount)}
        </Typography>
      </Box>
      <LinearProgress
        variant='determinate'
        value={row.progressPercent ?? 0}
        color={row.disbursementStatus === 'COMPLETED' ? 'success' : 'primary'}
        sx={{ height: 6, borderRadius: 3 }}
      />
      <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5 }}>
        {row.progressPercent ?? 0}% disbursed
      </Typography>
    </Box>
  )
}

function MobileDetailCard({
  row,
  isHistorical,
  showDisbursement,
  showLoanType
}: {
  row: ReportDetailRow
  isHistorical: boolean
  showDisbursement: boolean
  showLoanType: boolean
}) {
  const stageValue = isHistorical ? (
    <Chip size='small' color='warning' variant='outlined' label={row.auditStageName ?? row.stageName ?? '—'} sx={{ height: 22 }} />
  ) : (
    (row.stageName ?? '—')
  )

  return (
    <Card variant='outlined' sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1, mb: 1.25 }}>
          <Box sx={{ minWidth: 0 }}>
            <LeadIdentity customerName={row.customerName ?? 'Unknown customer'} code={row.leadCode} />
          </Box>
          <MuiLink
            component={Link}
            href={`/loan-cases/${row.leadId}`}
            underline='hover'
            variant='body2'
            sx={{ flexShrink: 0, fontWeight: 600 }}
          >
            View
          </MuiLink>
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(72px, auto) 1fr',
            columnGap: 1.5,
            rowGap: 0.75,
            alignItems: 'center'
          }}
        >
          {showLoanType ? <MobileDetailField label='Loan type' value={row.loanTypeName ?? '—'} /> : null}
          <MobileDetailField label='Bank' value={row.bankName ?? '—'} />
          <MobileDetailField label={isHistorical ? 'Stage (audit)' : 'Stage'} value={stageValue} />
          <MobileDetailField label='Agent' value={row.agentName ?? '—'} />
          <MobileDetailField
            label='Amount'
            value={
              <Typography component='span' fontWeight={700}>
                {formatINR(row.requestedAmount)}
              </Typography>
            }
          />
          <MobileDetailField
            label={isHistorical ? 'Staged' : 'Created'}
            value={isHistorical ? (row.auditStagedDate ?? '—') : formatDate(row.createdAt)}
          />
        </Box>
        {showDisbursement ? <MobileDisbursementBlock row={row} /> : null}
      </CardContent>
    </Card>
  )
}

export default function ReportsTableSection({ data, groupBySecondary }: Props) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isHistorical = data.dataMode === 'historical'
  const hasSecondary = Boolean(groupBySecondary && groupBySecondary !== data.groupBy)
  const showDisbursement = useMemo(() => hasReportDisbursementData(data.details), [data.details])
  const showLoanType = showsLoanTypeDetailColumn(data.groupBy, groupBySecondary)
  const groupBannerColSpan = (isHistorical ? 5 : 4) + (showLoanType ? 1 : 0)

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
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Typography variant='h6'>Grouped detail</Typography>
          <Typography variant='body2' color='text.secondary'>
            Nested by {groupingLabel}
            {data.details.length >= 500 ? ' (showing first 500 rows)' : ''}
            {showDisbursement ? ' · Includes disbursement balance & status' : ''}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
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
            <Card key={group.key} variant='outlined' sx={{ overflow: 'hidden' }}>
              <MobileGroupHeader
                groupLabel={group.label}
                count={group.count}
                amount={group.amount}
                collapsed={primaryCollapsed}
                onToggle={() => toggleGroup(primaryId)}
                tone='primary'
              />

              <Collapse in={!primaryCollapsed}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, pt: 1 }}>
                  {hasSecondary
                    ? group.subgroups.map(subgroup => {
                        const secondaryId = groupRowId('secondary', group.key, subgroup.key)
                        const secondaryCollapsed = isCollapsed(secondaryId)

                        return (
                          <Box
                            key={subgroup.key}
                            sx={{
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1.5,
                              overflow: 'hidden'
                            }}
                          >
                            <MobileGroupHeader
                              groupLabel={subgroup.label}
                              count={subgroup.count}
                              amount={subgroup.amount}
                              collapsed={secondaryCollapsed}
                              onToggle={() => toggleGroup(secondaryId)}
                              tone='secondary'
                            />
                            <Collapse in={!secondaryCollapsed}>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1.5, pt: 1, bgcolor: 'action.hover' }}>
                                {subgroup.rows.map(row => (
                                  <MobileDetailCard
                                    key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`}
                                    row={row}
                                    isHistorical={isHistorical}
                                    showDisbursement={showDisbursement}
                                    showLoanType={showLoanType}
                                  />
                                ))}
                              </Box>
                            </Collapse>
                          </Box>
                        )
                      })
                    : group.rows.map(row => (
                        <MobileDetailCard
                          key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`}
                          row={row}
                          isHistorical={isHistorical}
                          showDisbursement={showDisbursement}
                          showLoanType={showLoanType}
                        />
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
              {showDisbursement ? ' · Includes disbursement balance & status' : ''}
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

        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size='small' sx={{ tableLayout: 'fixed', minWidth: showDisbursement ? (showLoanType ? 980 : 900) : showLoanType ? 780 : 700 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 44, px: 0.5, textAlign: 'center' }} aria-label='Row level' />
                <TableCell sx={{ minWidth: 200 }}>{groupByLabel(data.groupBy)} / Customer</TableCell>
                {showLoanType ? <TableCell>Loan type</TableCell> : null}
                <TableCell>Bank</TableCell>
                <TableCell>{isHistorical ? 'Stage (audit)' : 'Stage'}</TableCell>
                {isHistorical ? <TableCell>Staged date</TableCell> : null}
                <TableCell>Agent</TableCell>
                <TableCell align='right' sx={{ width: 120 }}>
                  Amount
                </TableCell>
                {showDisbursement ? (
                  <>
                    <TableCell sx={{ width: 110 }}>Status</TableCell>
                    <TableCell align='right' sx={{ width: 140 }}>
                      Balance
                    </TableCell>
                  </>
                ) : null}
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
                      <GroupRowBannerCell
                        groupLabel={group.label}
                        collapsed={primaryCollapsed}
                        tone='primary'
                        count={group.count}
                        colSpan={groupBannerColSpan}
                      />
                      <GroupAmountCell amount={group.amount} label='Group total' />
                      {showDisbursement ? (
                        <>
                          <TableCell />
                          <TableCell />
                        </>
                      ) : null}
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
                                <GroupRowBannerCell
                                  groupLabel={subgroup.label}
                                  collapsed={secondaryCollapsed}
                                  tone='secondary'
                                  indent={1}
                                  count={subgroup.count}
                                  colSpan={groupBannerColSpan}
                                />
                                <GroupAmountCell amount={subgroup.amount} label='Subtotal' />
                                {showDisbursement ? (
                                  <>
                                    <TableCell />
                                    <TableCell />
                                  </>
                                ) : null}
                                {!isHistorical ? <TableCell /> : null}
                                <TableCell />
                              </TableRow>

                              {!secondaryCollapsed
                                ? subgroup.rows.map(row => (
                                    <TableRow key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`} hover>
                                      <TableCell sx={{ width: 44, px: 0.5, verticalAlign: 'middle' }}>
                                        <GroupLevelMarker level='detail' />
                                      </TableCell>
                                      <DetailRowCells
                                        row={row}
                                        isHistorical={isHistorical}
                                        showDisbursement={showDisbursement}
                                        showLoanType={showLoanType}
                                        indent={2}
                                      />
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
                            <DetailRowCells
                              row={row}
                              isHistorical={isHistorical}
                              showDisbursement={showDisbursement}
                              showLoanType={showLoanType}
                              indent={1}
                            />
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
