'use client'

import Link from 'next/link'
import { useMemo } from 'react'

import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

import type { AppointmentListItem } from '@features/appointments/services/appointments'
import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'

const QUEUE_LIMIT = 8
const ATTENTION_LIMIT = 8
const STALE_AFTER_DAYS = 7

const FOLLOW_UP_COLORS = {
  CALL: { main: 'var(--mui-palette-info-main)', bg: 'rgb(var(--mui-palette-info-mainChannel) / 0.12)' },
  WHATSAPP: { main: 'var(--mui-palette-success-main)', bg: 'rgb(var(--mui-palette-success-mainChannel) / 0.12)' },
  VISIT: { main: 'var(--mui-palette-warning-main)', bg: 'rgb(var(--mui-palette-warning-mainChannel) / 0.12)' },
  EMAIL: { main: 'var(--mui-palette-secondary-main)', bg: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.12)' },
  OTHER: { main: 'var(--mui-palette-text-secondary)', bg: 'rgb(var(--mui-palette-dividerChannel) / 0.24)' }
}

type FollowUpBucket = 'overdue' | 'today' | 'later'
type AttentionReason = 'docs' | 'no_followup' | 'stale'

type Props = {
  hasTenant: boolean
  followUpsLoading: boolean
  casesLoading: boolean
  error: string | null
  followUps: AppointmentListItem[]
  activeCases: LoanCaseListItem[]
  onOpenContact: (meeting: AppointmentListItem) => void
  panel: 'queue' | 'attention'
}

function isOpenAppointment(a: AppointmentListItem) {
  const status = String(a?.status || 'PENDING').toUpperCase()

  return status === 'PENDING' || status === 'SCHEDULED'
}

function startOfLocalDay(d: Date) {
  const next = new Date(d)

  next.setHours(0, 0, 0, 0)

  return next
}

function appointmentTime(a: AppointmentListItem) {
  if (!a?.scheduledAt) return NaN
  const dt = new Date(a.scheduledAt)

  return dt.getTime()
}

function formatCompactINR(amount: number) {
  const safe = Number.isFinite(amount) ? amount : 0

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(safe)
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] || ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ''

  return `${first}${last}`.toUpperCase()
}

function meetingTitle(m: AppointmentListItem, lead?: LoanCaseListItem) {
  if (m?.customerName) return m.customerName
  if (lead?.customerName) return lead.customerName
  if (m?.leadTitle) return m.leadTitle
  if (m?.followUpType) return `${String(m.followUpType).toLowerCase()} follow-up`

  return 'Follow-up'
}

function meetingTypeMeta(m: AppointmentListItem) {
  const t = String(m?.followUpType || '').toUpperCase()

  if (t === 'CALL') return { label: 'Call', icon: 'ri-phone-line', color: FOLLOW_UP_COLORS.CALL.bg, text: FOLLOW_UP_COLORS.CALL.main }
  if (t === 'WHATSAPP') return { label: 'WhatsApp', icon: 'ri-whatsapp-line', color: FOLLOW_UP_COLORS.WHATSAPP.bg, text: FOLLOW_UP_COLORS.WHATSAPP.main }
  if (t === 'VISIT') return { label: 'Visit', icon: 'ri-map-pin-line', color: FOLLOW_UP_COLORS.VISIT.bg, text: FOLLOW_UP_COLORS.VISIT.main }
  if (t === 'EMAIL') return { label: 'Email', icon: 'ri-mail-line', color: FOLLOW_UP_COLORS.EMAIL.bg, text: FOLLOW_UP_COLORS.EMAIL.main }

  return { label: 'Meet', icon: 'ri-calendar-event-line', color: FOLLOW_UP_COLORS.OTHER.bg, text: FOLLOW_UP_COLORS.OTHER.main }
}

function formatFollowUpWhen(m: AppointmentListItem, bucket: FollowUpBucket) {
  if (!m?.scheduledAt) return 'Unscheduled'
  const start = new Date(m.scheduledAt)

  if (!Number.isFinite(start.getTime())) return 'Unscheduled'

  const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit' })
  const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
  const weekdayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'short' })

  if (bucket === 'today') return timeFmt.format(start)

  if (bucket === 'overdue') {
    const hours = Math.max(1, Math.round((Date.now() - start.getTime()) / (60 * 60 * 1000)))

    if (hours < 24) return `${hours}h overdue`

    const days = Math.max(1, Math.round(hours / 24))

    return `${days}d overdue`
  }

  const today = startOfLocalDay(new Date())
  const day = startOfLocalDay(start)
  const diffDays = Math.round((day.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))

  if (diffDays === 1) return `Tomorrow ${timeFmt.format(start)}`
  if (diffDays < 7) return `${weekdayFmt.format(start)} ${timeFmt.format(start)}`

  return `${dateFmt.format(start)} ${timeFmt.format(start)}`
}

function daysSince(iso: string | null | undefined) {
  if (!iso) return Number.POSITIVE_INFINITY
  const dt = new Date(iso)

  if (!Number.isFinite(dt.getTime())) return Number.POSITIVE_INFINITY

  return Math.floor((Date.now() - dt.getTime()) / (24 * 60 * 60 * 1000))
}

function pendingDocsCount(c: LoanCaseListItem) {
  if (typeof c.pendingDocumentsCount === 'number') return c.pendingDocumentsCount
  if (typeof c.incompleteDocumentsCount === 'number') return c.incompleteDocumentsCount

  return c.hasIncompleteDocuments ? 1 : 0
}

function attentionMeta(reason: AttentionReason) {
  if (reason === 'docs') {
    return {
      group: 'Papers still pending',
      action: 'Collect papers',
      icon: 'ri-file-list-3-line',
      tone: 'warning' as const,
      accent: 'var(--mui-palette-warning-main)',
      bg: 'rgb(var(--mui-palette-warning-mainChannel) / 0.12)'
    }
  }

  if (reason === 'stale') {
    return {
      group: 'Quiet file',
      action: 'Chase now',
      icon: 'ri-timer-flash-line',
      tone: 'error' as const,
      accent: 'var(--mui-palette-error-main)',
      bg: 'rgb(var(--mui-palette-error-mainChannel) / 0.12)'
    }
  }

  return {
    group: 'No appointment',
    action: 'Book follow-up',
    icon: 'ri-calendar-schedule-line',
    tone: 'info' as const,
    accent: 'var(--mui-palette-info-main)',
    bg: 'rgb(var(--mui-palette-info-mainChannel) / 0.12)'
  }
}

function AmountCell({ amount }: { amount: number }) {
  return (
    <Typography
      variant='caption'
      sx={{
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
        textAlign: 'right',
        whiteSpace: 'nowrap',
        minWidth: '4.75rem',
        color: amount > 0 ? 'text.primary' : 'text.disabled'
      }}
    >
      {amount > 0 ? formatCompactINR(amount) : '—'}
    </Typography>
  )
}

export default function AgentWorkQueue({
  hasTenant,
  followUpsLoading,
  casesLoading,
  error,
  followUps,
  activeCases,
  onOpenContact,
  panel
}: Props) {
  const leadById = useMemo(() => {
    const map = new Map<string, LoanCaseListItem>()

    activeCases.forEach(c => map.set(c.id, c))

    return map
  }, [activeCases])

  const queue = useMemo(() => {
    const now = Date.now()
    const todayStart = startOfLocalDay(new Date()).getTime()
    const tomorrowStart = todayStart + 24 * 60 * 60 * 1000

    const open = followUps.filter(isOpenAppointment).sort((a, b) => appointmentTime(a) - appointmentTime(b))

    const overdue: AppointmentListItem[] = []
    const today: AppointmentListItem[] = []
    const later: AppointmentListItem[] = []

    open.forEach(a => {
      const t = appointmentTime(a)

      if (!Number.isFinite(t)) return
      if (t < now) overdue.push(a)
      else if (t < tomorrowStart) today.push(a)
      else later.push(a)
    })

    const picked: Array<{ item: AppointmentListItem; bucket: FollowUpBucket }> = []

    const take = (items: AppointmentListItem[], bucket: FollowUpBucket) => {
      for (const item of items) {
        if (picked.length >= QUEUE_LIMIT) break
        picked.push({ item, bucket })
      }
    }

    take(overdue, 'overdue')
    take(today, 'today')
    take(later, 'later')

    return {
      overdueCount: overdue.length,
      todayCount: today.length,
      laterCount: later.length,
      rows: picked,
      hiddenCount: Math.max(0, overdue.length + today.length + later.length - picked.length)
    }
  }, [followUps])

  const followUpLeadIds = useMemo(() => {
    const ids = new Set<string>()

    followUps.forEach(a => {
      if (!isOpenAppointment(a)) return
      if (a.leadId) ids.add(a.leadId)
    })

    return ids
  }, [followUps])

  const attention = useMemo(() => {
    const ranked = activeCases
      .map(c => {
        const docs = pendingDocsCount(c)
        const staleDays = daysSince(c.updatedAt)
        const hasFollowUp = Boolean(c.id && followUpLeadIds.has(c.id))

        if (hasFollowUp) return null

        let reason: AttentionReason
        let hint = ''

        if (docs > 0) {
          reason = 'docs'
          hint = docs === 1 ? '1 document still needed' : `${docs} documents still needed`
        } else if (staleDays >= STALE_AFTER_DAYS) {
          reason = 'stale'
          hint = staleDays >= 30 ? 'Lead not touched in a month · no appointment' : `Lead not touched in ${staleDays} days · no appointment`
        } else {
          reason = 'no_followup'
          hint = 'Lead was updated recently · next call/visit not booked'
        }

        return {
          case: c,
          reason,
          hint,
          amount: resolveApprovedAmount(c) ?? 0
        }
      })
      .filter(Boolean) as Array<{
      case: LoanCaseListItem
      reason: AttentionReason
      hint: string
      amount: number
    }>

    const order: Record<AttentionReason, number> = { docs: 0, stale: 1, no_followup: 2 }

    ranked.sort((a, b) => {
      const byReason = order[a.reason] - order[b.reason]

      if (byReason !== 0) return byReason

      return b.amount - a.amount
    })

    return {
      docsCount: ranked.filter(r => r.reason === 'docs').length,
      noFollowUpCount: ranked.filter(r => r.reason === 'no_followup').length,
      staleCount: ranked.filter(r => r.reason === 'stale').length,
      rows: ranked.slice(0, ATTENTION_LIMIT),
      hiddenCount: Math.max(0, ranked.length - ATTENTION_LIMIT)
    }
  }, [activeCases, followUpLeadIds])

  return panel === 'queue' ? (
      <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0, height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 1.5,
              flexWrap: 'wrap'
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='h6' sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Follow-up queue
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Overdue first, then today — tap to call or open the file
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
              {queue.overdueCount > 0 ? (
                <Chip size='small' color='error' label={`${queue.overdueCount} overdue`} sx={{ height: 24, fontWeight: 700 }} />
              ) : null}
              {queue.todayCount > 0 ? (
                <Chip size='small' color='primary' variant='outlined' label={`${queue.todayCount} today`} sx={{ height: 24 }} />
              ) : null}
              <Button component={Link} href='/appointments' size='small' sx={{ minWidth: 0, px: 1 }}>
                All
              </Button>
            </Box>
          </Box>

          {!hasTenant ? (
            <Typography variant='body2' color='text.secondary'>
              Select an organisation to see your queue.
            </Typography>
          ) : followUpsLoading ? (
            <Typography variant='body2' color='text.secondary'>
              Loading follow-ups…
            </Typography>
          ) : error ? (
            <Typography variant='body2' color='error'>
              {error}
            </Typography>
          ) : queue.rows.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant='body2' sx={{ fontWeight: 600 }}>
                Queue is clear
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                No overdue or upcoming follow-ups in the next two weeks.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flex: 1 }}>
              {queue.rows.map((row, idx) => {
                const showHeading = idx === 0 || queue.rows[idx - 1].bucket !== row.bucket
                const lead = row.item.leadId ? leadById.get(row.item.leadId) : undefined
                const title = meetingTitle(row.item, lead)
                const tag = meetingTypeMeta(row.item)
                const followUpType = String(row.item.followUpType || '').toUpperCase()
                const canOpenContact = followUpType === 'CALL' || followUpType === 'WHATSAPP'
                const amount = lead ? resolveApprovedAmount(lead) : null
                const docs = lead ? pendingDocsCount(lead) : 0
                const href = row.item.leadId ? `/loan-cases/${row.item.leadId}` : '/appointments'
                const heading =
                  row.bucket === 'overdue' ? 'Overdue' : row.bucket === 'today' ? 'Today' : 'Upcoming'

                return (
                  <Box key={row.item.id}>
                    {showHeading ? (
                      <Typography
                        variant='caption'
                        color={row.bucket === 'overdue' ? 'error.main' : 'text.secondary'}
                        sx={{ fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', display: 'block', mt: idx === 0 ? 0 : 1, mb: 0.5 }}
                      >
                        {heading}
                      </Typography>
                    ) : null}
                    <Box
                      component={Link}
                      href={href}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '32px minmax(0, 1fr) 4.75rem',
                          sm: '32px minmax(0, 1fr) 4.75rem max-content'
                        },
                        gridTemplateAreas: {
                          xs: '"avatar copy amount" "avatar meta amount" ". action action"',
                          sm: '"avatar copy amount action" "avatar meta amount action"'
                        },
                        columnGap: 1.25,
                        rowGap: 0.15,
                        alignItems: 'center',
                        px: 0.75,
                        py: 0.85,
                        borderRadius: 2,
                        textDecoration: 'none',
                        color: 'inherit',
                        minWidth: 0,
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <Avatar
                        sx={{
                          gridArea: 'avatar',
                          width: 32,
                          height: 32,
                          bgcolor:
                            row.bucket === 'overdue'
                              ? 'rgb(var(--mui-palette-error-mainChannel) / 0.12)'
                              : 'rgb(var(--mui-palette-primary-mainChannel) / 0.12)',
                          color: row.bucket === 'overdue' ? 'error.main' : 'primary.main',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {initials(title)}
                      </Avatar>
                      <Typography
                        variant='subtitle2'
                        noWrap
                        sx={{ gridArea: 'copy', fontWeight: 700, lineHeight: 1.25, minWidth: 0 }}
                      >
                        {title}
                      </Typography>
                      <Box sx={{ gridArea: 'amount', alignSelf: { xs: 'start', sm: 'center' } }}>
                        <AmountCell amount={amount || 0} />
                      </Box>
                      <Typography variant='caption' color='text.secondary' noWrap sx={{ gridArea: 'meta', lineHeight: 1.35, minWidth: 0 }}>
                        {[
                          formatFollowUpWhen(row.item, row.bucket),
                          lead?.stageName,
                          docs > 0 ? `${docs} papers pending` : null,
                          row.item.customerIsNRI ? 'NRI' : null
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Typography>
                      <Box
                        component='span'
                        role={canOpenContact ? 'button' : undefined}
                        tabIndex={canOpenContact ? 0 : undefined}
                        onClick={
                          canOpenContact
                            ? e => {
                                e.preventDefault()
                                e.stopPropagation()
                                onOpenContact(row.item)
                              }
                            : undefined
                        }
                        onKeyDown={
                          canOpenContact
                            ? e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  onOpenContact(row.item)
                                }
                              }
                            : undefined
                        }
                        sx={{
                          gridArea: 'action',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.4,
                          px: 0.9,
                          height: 26,
                          mt: { xs: 0.35, sm: 0 },
                          justifySelf: { xs: 'start', sm: 'end' },
                          borderRadius: 999,
                          backgroundColor: tag.color,
                          color: tag.text,
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          cursor: canOpenContact ? 'pointer' : 'default',
                          '& i': { fontSize: '0.95rem' }
                        }}
                      >
                        <i className={tag.icon} />
                        <Box component='span'>{tag.label}</Box>
                      </Box>
                    </Box>
                  </Box>
                )
              })}
              {queue.hiddenCount > 0 ? (
                <Button component={Link} href='/appointments' size='small' sx={{ alignSelf: 'flex-start', mt: 0.5 }}>
                  +{queue.hiddenCount} more follow-ups
                </Button>
              ) : null}
            </Box>
          )}
        </CardContent>
      </Card>
  ) : (
      <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0, height: '100%' }}>
        <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: { xs: 'flex-start', sm: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              mb: 1.5,
              flexWrap: 'wrap'
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant='h6' sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Needs attention
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Live files only — disbursed, closed, and rejected are skipped
              </Typography>
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.5, lineHeight: 1.45 }}>
                Quiet file = the lead was not edited for 7+ days. No appointment = the calendar has no next call or
                visit.
              </Typography>
            </Box>
            <Button component={Link} href='/loan-cases/pipeline' size='small' sx={{ minWidth: 0, px: 1 }}>
              Pipeline
            </Button>
          </Box>

          {!hasTenant ? (
            <Typography variant='body2' color='text.secondary'>
              Select an organisation to see at-risk files.
            </Typography>
          ) : casesLoading ? (
            <Typography variant='body2' color='text.secondary'>
              Scanning open files…
            </Typography>
          ) : attention.rows.length === 0 ? (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <Typography variant='body2' sx={{ fontWeight: 600 }}>
                All clear
              </Typography>
              <Typography variant='caption' color='text.secondary'>
                Every open file already has a follow-up on the queue.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, flex: 1 }}>
              {attention.rows.map((row, idx) => {
                const meta = attentionMeta(row.reason)
                const title = row.case.customerName || row.case.loanTypeName || 'Lead'
                const showHeading = idx === 0 || attention.rows[idx - 1].reason !== row.reason

                return (
                  <Box key={row.case.id}>
                    {showHeading ? (
                      <Typography
                        variant='caption'
                        sx={{
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color: meta.accent,
                          display: 'block',
                          mt: idx === 0 ? 0 : 1.25,
                          mb: 0.5
                        }}
                      >
                        {meta.group} ·{' '}
                        {row.reason === 'docs'
                          ? attention.docsCount
                          : row.reason === 'stale'
                            ? attention.staleCount
                            : attention.noFollowUpCount}
                      </Typography>
                    ) : null}
                    <Box
                      component={Link}
                      href={`/loan-cases/${row.case.id}`}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                          xs: '32px minmax(0, 1fr) 4.75rem',
                          sm: '32px minmax(0, 1fr) 4.75rem max-content'
                        },
                        gridTemplateAreas: {
                          xs: '"avatar copy amount" "avatar meta amount" ". action action"',
                          sm: '"avatar copy amount action" "avatar meta amount action"'
                        },
                        columnGap: 1.25,
                        rowGap: 0.15,
                        alignItems: 'center',
                        px: 0.75,
                        py: 0.9,
                        borderRadius: 2,
                        textDecoration: 'none',
                        color: 'inherit',
                        minWidth: 0,
                        borderLeft: '3px solid',
                        borderLeftColor: meta.accent,
                        '&:hover': { backgroundColor: 'action.hover' }
                      }}
                    >
                      <Avatar
                        sx={{
                          gridArea: 'avatar',
                          width: 32,
                          height: 32,
                          bgcolor: meta.bg,
                          color: meta.accent,
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          alignSelf: 'center'
                        }}
                      >
                        <i className={meta.icon} style={{ fontSize: '1rem' }} />
                      </Avatar>
                      <Typography
                        variant='subtitle2'
                        noWrap
                        sx={{ gridArea: 'copy', fontWeight: 700, lineHeight: 1.25, minWidth: 0 }}
                      >
                        {title}
                      </Typography>
                      <Box sx={{ gridArea: 'amount', alignSelf: { xs: 'start', sm: 'center' }, pt: { xs: 0.15, sm: 0 } }}>
                        <AmountCell amount={row.amount} />
                      </Box>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        noWrap
                        sx={{ gridArea: 'meta', lineHeight: 1.35, minWidth: 0 }}
                      >
                        {[row.case.stageName, row.hint].filter(Boolean).join(' · ')}
                      </Typography>
                      <Chip
                        size='small'
                        color={meta.tone}
                        variant='outlined'
                        label={meta.action}
                        sx={{
                          gridArea: 'action',
                          height: 24,
                          mt: { xs: 0.35, sm: 0 },
                          justifySelf: { xs: 'start', sm: 'end' },
                          fontWeight: 700,
                          maxWidth: '100%'
                        }}
                      />
                    </Box>
                  </Box>
                )
              })}
              {attention.hiddenCount > 0 ? (
                <Button component={Link} href='/loan-cases' size='small' sx={{ alignSelf: 'flex-start', mt: 0.75 }}>
                  +{attention.hiddenCount} more files
                </Button>
              ) : null}
            </Box>
          )}
        </CardContent>
      </Card>
  )
}
