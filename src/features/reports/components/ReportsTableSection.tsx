'use client'

import { Fragment, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'

import Link from 'next/link'

import Avatar from '@mui/material/Avatar'
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
  stagedDateLabel?: string
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

const CUSTOMER_AVATAR_TONES = ['primary', 'success', 'warning', 'info', 'secondary', 'error'] as const

function customerInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean)

  if (parts.length === 0) return '?'

  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''

  return `${first}${last}`.toUpperCase() || '?'
}

/** Stable per-customer colour so the same person keeps the same avatar tone across runs. */
function customerAvatarTone(name: string) {
  let hash = 0

  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 9973

  return CUSTOMER_AVATAR_TONES[hash % CUSTOMER_AVATAR_TONES.length]
}

function ReportCustomerCell({ row, size = 'default' }: { row: ReportDetailRow; size?: 'default' | 'large' }) {
  const theme = useTheme()
  const name = (row.customerName ?? '').trim() || 'Unknown customer'
  const tone = theme.palette[customerAvatarTone(name)]
  const avatarSize = size === 'large' ? 38 : 32
  const phone = row.customerPhone?.trim() || null
  const dialable = phone ? phone.replace(/[^\d+]/g, '') : null

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
      <Avatar
        sx={{
          width: avatarSize,
          height: avatarSize,
          flexShrink: 0,
          fontSize: size === 'large' ? '0.85rem' : '0.75rem',
          fontWeight: 800,
          letterSpacing: 0.3,
          bgcolor: alpha(tone.main, 0.12),
          color: tone.main,
          border: `1px solid ${alpha(tone.main, 0.28)}`
        }}
      >
        {customerInitials(name)}
      </Avatar>
      <Box sx={{ minWidth: 0 }}>
        <MuiLink
          component={Link}
          href={`/loan-cases/${row.leadId}`}
          underline='hover'
          color='text.primary'
          title={name}
          sx={{
            display: 'block',
            fontWeight: 800,
            fontSize: size === 'large' ? '0.95rem' : '0.875rem',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {name}
        </MuiLink>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mt: 0.15, minWidth: 0 }}>
          {row.leadCode ? (
            <Typography
              variant='caption'
              color='text.secondary'
              title={row.leadCode}
              sx={{
                fontFamily: 'monospace',
                fontWeight: 600,
                letterSpacing: 0.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: '1 1 4rem',
                minWidth: 0
              }}
            >
              {row.leadCode}
            </Typography>
          ) : null}
          {row.leadCode && phone ? (
            <Box sx={{ width: 3, height: 3, borderRadius: '50%', bgcolor: 'text.disabled', flexShrink: 0 }} />
          ) : null}
          {phone ? (
            <MuiLink
              href={`tel:${dialable}`}
              underline='none'
              variant='caption'
              color='text.secondary'
              title={`Call ${phone}`}
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.35,
                whiteSpace: 'nowrap',
                flexShrink: 0,
                '&:hover': { color: 'primary.main' }
              }}
            >
              <Box component='i' className='ri-phone-line' sx={{ fontSize: '0.85rem', lineHeight: 1 }} />
              {phone}
            </MuiLink>
          ) : null}
        </Box>
      </Box>
    </Box>
  )
}

function HistoricalStageSummary({ row }: { row: ReportDetailRow }) {
  const eventStage = row.auditStageName ?? row.stageName ?? '—'
  const currentStage = row.stageName ?? null
  const hasMovedOn = Boolean(currentStage && currentStage !== eventStage)

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, minWidth: 0 }}>
      <Chip
        size='small'
        color='warning'
        variant='outlined'
        label={eventStage}
        title={hasMovedOn ? `${eventStage} in this period` : eventStage}
        sx={{ maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
      />
      {hasMovedOn ? (
        <Box
          sx={{ display: 'flex', alignItems: 'center', gap: 0.25, minWidth: 0 }}
          title={`Now in ${currentStage}`}
        >
          <Box
            component='i'
            className='ri-arrow-right-line'
            sx={{ color: 'text.disabled', fontSize: '0.95rem', lineHeight: 1 }}
          />
          <Typography
            variant='caption'
            sx={{
              fontWeight: 700,
              color: 'info.main',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {currentStage}
          </Typography>
        </Box>
      ) : null}
    </Box>
  )
}

const CUSTOMER_COLUMN_WIDTH = 300
const LEVEL_COLUMN_WIDTH = 44
const AMOUNT_COLUMN_WIDTH = 128

function stickyLevelCellSx(bgcolor: string, zIndex = 2) {
  return {
    position: 'sticky' as const,
    left: 0,
    zIndex,
    bgcolor,
    width: LEVEL_COLUMN_WIDTH,
    minWidth: LEVEL_COLUMN_WIDTH,
    maxWidth: LEVEL_COLUMN_WIDTH,
    px: 0.5,
    verticalAlign: 'middle' as const
  }
}

function stickyCustomerCellSx(bgcolor: string, indent = 0, zIndex = 2) {
  return {
    position: 'sticky' as const,
    left: LEVEL_COLUMN_WIDTH,
    zIndex,
    bgcolor,
    pl: 2 + indent * 3,
    width: CUSTOMER_COLUMN_WIDTH,
    minWidth: CUSTOMER_COLUMN_WIDTH,
    maxWidth: CUSTOMER_COLUMN_WIDTH,
    boxShadow: `4px 0 12px -6px ${alpha('#000', 0.18)}`
  }
}

function stickyAmountCellSx(bgcolor: string, zIndex = 2) {
  return {
    position: 'sticky' as const,
    right: 0,
    zIndex,
    bgcolor,
    width: AMOUNT_COLUMN_WIDTH,
    minWidth: AMOUNT_COLUMN_WIDTH,
    maxWidth: AMOUNT_COLUMN_WIDTH,
    whiteSpace: 'nowrap' as const,
    textAlign: 'right' as const,
    boxShadow: `-4px 0 12px -6px ${alpha('#000', 0.18)}`
  }
}

const themedTableScrollSx = {
  overflowX: 'auto' as const,
  scrollbarWidth: 'thin' as const,
  scrollbarColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.35) transparent',
  '&::-webkit-scrollbar': {
    height: 10
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'transparent'
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.3)',
    borderRadius: 999,
    border: '3px solid transparent',
    backgroundClip: 'content-box'
  },
  '&::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.45)'
  }
}

function DetailRowCells({
  row,
  isHistorical,
  showDisbursement,
  showLoanType,
  indent = 0,
  stickyBgcolor
}: {
  row: ReportDetailRow
  isHistorical: boolean
  showDisbursement: boolean
  showLoanType: boolean
  indent?: number
  stickyBgcolor: string
}) {
  return (
    <>
      <TableCell data-sticky sx={stickyCustomerCellSx(stickyBgcolor, indent)}>
        <ReportCustomerCell row={row} />
      </TableCell>
      {showLoanType ? <TableCell>{row.loanTypeName ?? '—'}</TableCell> : null}
      <TableCell>{row.bankName ?? '—'}</TableCell>
      <TableCell>{isHistorical ? <HistoricalStageSummary row={row} /> : row.stageName ?? '—'}</TableCell>
      {isHistorical ? <TableCell>{row.auditStagedDate ?? '—'}</TableCell> : null}
      <TableCell>{row.agentName ?? '—'}</TableCell>
      <TableCell data-sticky align='right' sx={stickyAmountCellSx(stickyBgcolor)}>
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

function GroupAmountCell({
  amount,
  label,
  stickyBgcolor,
  zIndex = 2
}: {
  amount: number
  label: string
  stickyBgcolor: string
  zIndex?: number
}) {
  return (
    <TableCell data-sticky align='right' sx={stickyAmountCellSx(stickyBgcolor, zIndex)}>
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
      <Typography variant='caption' color='text.secondary' sx={{ pt: 0.25, minWidth: 0 }}>
        {label}
      </Typography>
      <Typography component='div' variant='body2' sx={{ minWidth: 0, display: 'flex', alignItems: 'center', wordBreak: 'break-word' }}>
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
  showLoanType,
  stagedDateLabel
}: {
  row: ReportDetailRow
  isHistorical: boolean
  showDisbursement: boolean
  showLoanType: boolean
  stagedDateLabel: string
}) {
  const stageValue = isHistorical ? <HistoricalStageSummary row={row} /> : row.stageName ?? '—'

  return (
    <Card variant='outlined' sx={{ borderColor: 'divider' }}>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Box sx={{ mb: 1.25, pb: 1.25, borderBottom: '1px dashed', borderColor: 'divider' }}>
          <ReportCustomerCell row={row} size='large' />
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
          <MobileDetailField label={isHistorical ? 'Stage → current' : 'Stage'} value={stageValue} />
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
            label={isHistorical ? stagedDateLabel : 'Created'}
            value={isHistorical ? (row.auditStagedDate ?? '—') : formatDate(row.createdAt)}
          />
        </Box>
        {showDisbursement ? <MobileDisbursementBlock row={row} /> : null}
      </CardContent>
    </Card>
  )
}

export default function ReportsTableSection({ data, groupBySecondary, stagedDateLabel = 'Staged date' }: Props) {
  const theme = useTheme()
  const isCompact = useMediaQuery(theme.breakpoints.down('lg'))
  const isHistorical = data.dataMode === 'historical'
  const hasSecondary = Boolean(groupBySecondary && groupBySecondary !== data.groupBy)
  const showDisbursement = useMemo(() => hasReportDisbursementData(data.details), [data.details])
  const showLoanType = showsLoanTypeDetailColumn(data.groupBy, groupBySecondary)
  const groupBannerColSpan = (isHistorical ? 5 : 4) + (showLoanType ? 1 : 0)

  const tableMinWidth = (() => {
    let width = LEVEL_COLUMN_WIDTH + CUSTOMER_COLUMN_WIDTH + AMOUNT_COLUMN_WIDTH
    width += 140 // stage
    width += 110 // bank
    width += 140 // agent
    if (showLoanType) width += 110
    if (isHistorical) width += 120 // staged date
    else width += 110 // created
    if (showDisbursement) width += 250

    return width
  })()

  const stickyPrimary = alpha(theme.palette.primary.main, 0.14)
  const stickySecondary = alpha(theme.palette.secondary.main, 0.1)
  const stickyHeader = theme.palette.background.paper
  const stickyDetail = theme.palette.background.paper
  const stickyDetailHover = theme.palette.action.hover

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
    bgcolor: stickyPrimary,
    borderLeft: `4px solid ${theme.palette.primary.main}`,
    '& > td': { borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.25)}` },
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.22) },
    '&:hover > td[data-sticky]': { bgcolor: alpha(theme.palette.primary.main, 0.22) }
  }

  const secondaryStyles = {
    bgcolor: stickySecondary,
    borderLeft: `4px solid ${theme.palette.secondary.main}`,
    '& > td': { borderBottom: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}` },
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
    '&:hover': { bgcolor: alpha(theme.palette.secondary.main, 0.18) },
    '&:hover > td[data-sticky]': { bgcolor: alpha(theme.palette.secondary.main, 0.18) }
  }

  if (isCompact) {
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
                                    stagedDateLabel={stagedDateLabel}
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
                          stagedDateLabel={stagedDateLabel}
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

        <TableContainer sx={themedTableScrollSx}>
          <Table size='small' sx={{ width: '100%', tableLayout: 'fixed', minWidth: tableMinWidth }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ ...stickyLevelCellSx(stickyHeader, 4), textAlign: 'center' }} aria-label='Row level' />
                <TableCell sx={stickyCustomerCellSx(stickyHeader, 0, 4)}>
                  {groupByLabel(data.groupBy)} / Customer
                </TableCell>
                {showLoanType ? <TableCell>Loan type</TableCell> : null}
                <TableCell>Bank</TableCell>
                <TableCell>{isHistorical ? 'Stage → current' : 'Stage'}</TableCell>
                {isHistorical ? <TableCell>{stagedDateLabel}</TableCell> : null}
                <TableCell>Agent</TableCell>
                <TableCell data-sticky align='right' sx={stickyAmountCellSx(stickyHeader, 4)}>
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
                      <TableCell data-sticky sx={stickyLevelCellSx(stickyPrimary)}>
                        <GroupLevelMarker level='primary' />
                      </TableCell>
                      <GroupRowBannerCell
                        groupLabel={group.label}
                        collapsed={primaryCollapsed}
                        tone='primary'
                        count={group.count}
                        colSpan={groupBannerColSpan}
                      />
                      <GroupAmountCell amount={group.amount} label='Group total' stickyBgcolor={stickyPrimary} />
                      {showDisbursement ? (
                        <>
                          <TableCell />
                          <TableCell />
                        </>
                      ) : null}
                      {!isHistorical ? <TableCell /> : null}
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
                                <TableCell data-sticky sx={stickyLevelCellSx(stickySecondary)}>
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
                                <GroupAmountCell amount={subgroup.amount} label='Subtotal' stickyBgcolor={stickySecondary} />
                                {showDisbursement ? (
                                  <>
                                    <TableCell />
                                    <TableCell />
                                  </>
                                ) : null}
                                {!isHistorical ? <TableCell /> : null}
                              </TableRow>

                              {!secondaryCollapsed
                                ? subgroup.rows.map(row => (
                                    <TableRow
                                      key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`}
                                      hover
                                      sx={{
                                        '&:hover > td[data-sticky]': { bgcolor: stickyDetailHover }
                                      }}
                                    >
                                      <TableCell data-sticky sx={stickyLevelCellSx(stickyDetail)}>
                                        <GroupLevelMarker level='detail' />
                                      </TableCell>
                                      <DetailRowCells
                                        row={row}
                                        isHistorical={isHistorical}
                                        showDisbursement={showDisbursement}
                                        showLoanType={showLoanType}
                                        indent={2}
                                        stickyBgcolor={stickyDetail}
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
                          <TableRow
                            key={`${row.leadId}-${row.auditStagedDate ?? row.createdAt}`}
                            hover
                            sx={{
                              '&:hover > td[data-sticky]': { bgcolor: stickyDetailHover }
                            }}
                          >
                            <TableCell data-sticky sx={stickyLevelCellSx(stickyDetail)}>
                              <GroupLevelMarker level='detail' />
                            </TableCell>
                            <DetailRowCells
                              row={row}
                              isHistorical={isHistorical}
                              showDisbursement={showDisbursement}
                              showLoanType={showLoanType}
                              indent={1}
                              stickyBgcolor={stickyDetail}
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
