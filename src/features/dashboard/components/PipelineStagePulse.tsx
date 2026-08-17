'use client'

import { useMemo } from 'react'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Typography from '@mui/material/Typography'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'
import { findLoggedInStageIds, type PipelineStageLike } from '@features/loan-status-pipeline/stageFlags'

const PULSE_LIMIT = 6

type Props = {
  hasTenant: boolean
  loading: boolean
  cases: LoanCaseListItem[]
  stages: PipelineStageLike[]
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

function idleDays(iso: string | null | undefined) {
  if (!iso) return null
  const t = new Date(iso).getTime()

  if (!Number.isFinite(t)) return null

  return Math.max(0, Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000)))
}

function pendingDocs(c: LoanCaseListItem) {
  if (typeof c.pendingDocumentsCount === 'number') return c.pendingDocumentsCount
  if (typeof c.incompleteDocumentsCount === 'number') return c.incompleteDocumentsCount

  return c.hasIncompleteDocuments ? 1 : 0
}

function SplitTile({
  label,
  count,
  amount,
  accent
}: {
  label: string
  count: number
  amount: number
  accent: 'warning' | 'info'
}) {
  const color = accent === 'warning' ? 'warning.main' : 'info.main'
  const bg =
    accent === 'warning'
      ? 'rgb(var(--mui-palette-warning-mainChannel) / 0.1)'
      : 'rgb(var(--mui-palette-info-mainChannel) / 0.1)'

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        background: bg
      }}
    >
      <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
        {label}
      </Typography>
      <Typography variant='h6' sx={{ fontWeight: 800, lineHeight: 1.2, mt: 0.25, color }}>
        {count.toLocaleString()}
      </Typography>
      <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
        {formatCompactINR(amount)}
      </Typography>
    </Box>
  )
}

export default function PipelineStagePulse({ hasTenant, loading, cases, stages }: Props) {
  const loggedInIds = useMemo(() => new Set(findLoggedInStageIds(stages)), [stages])
  const loggedInConfigured = loggedInIds.size > 0

  const pulse = useMemo(() => {
    const byId = new Map<
      string,
      {
        stageId: string
        stageName: string
        order: number
        count: number
        totalValue: number
        idleSum: number
        idleN: number
        docsFiles: number
        isLoggedIn: boolean
      }
    >()

    cases.forEach(c => {
      const stageId = c.stageId || 'unknown'
      const stage = stages.find(s => s.id === stageId)
      const prev = byId.get(stageId) || {
        stageId,
        stageName: stage?.name || c.stageName || 'Stage',
        order: stage?.order || 0,
        count: 0,
        totalValue: 0,
        idleSum: 0,
        idleN: 0,
        docsFiles: 0,
        isLoggedIn: loggedInIds.has(stageId)
      }
      const days = idleDays(c.updatedAt)

      byId.set(stageId, {
        ...prev,
        count: prev.count + 1,
        totalValue: prev.totalValue + (resolveApprovedAmount(c) ?? 0),
        idleSum: prev.idleSum + (days ?? 0),
        idleN: prev.idleN + (days == null ? 0 : 1),
        docsFiles: prev.docsFiles + (pendingDocs(c) > 0 ? 1 : 0)
      })
    })

    const rows = Array.from(byId.values())
      .map(r => ({
        ...r,
        avgIdleDays: r.idleN > 0 ? Math.round(r.idleSum / r.idleN) : 0
      }))
      .sort((a, b) => b.avgIdleDays - a.avgIdleDays || b.totalValue - a.totalValue)

    let preLogin = { count: 0, amount: 0 }
    let loggedIn = { count: 0, amount: 0 }

    cases.forEach(c => {
      const amount = resolveApprovedAmount(c) ?? 0
      const inLogin = Boolean(c.stageId && loggedInIds.has(c.stageId))

      if (inLogin) {
        loggedIn = { count: loggedIn.count + 1, amount: loggedIn.amount + amount }
      } else {
        preLogin = { count: preLogin.count + 1, amount: preLogin.amount + amount }
      }
    })

    return {
      rows: rows.slice(0, PULSE_LIMIT),
      preLogin,
      loggedIn,
      slowest: rows[0] || null
    }
  }, [cases, stages, loggedInIds])

  const maxIdle = Math.max(1, ...pulse.rows.map(r => r.avgIdleDays))

  return (
    <Card sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider', minWidth: 0, height: '100%' }}>
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant='h6' sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Live book pulse
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Login progress and which stage is aging
            </Typography>
          </Box>
          <Button component={Link} href='/loan-cases/pipeline' size='small' sx={{ minWidth: 0, px: 1, flexShrink: 0 }}>
            Open
          </Button>
        </Box>

        {!hasTenant ? (
          <Typography variant='body2' color='text.secondary'>
            Select an organisation to see live stages.
          </Typography>
        ) : loading ? (
          <Typography variant='body2' color='text.secondary'>
            Reading open files…
          </Typography>
        ) : cases.length === 0 ? (
          <Typography variant='body2' color='text.secondary'>
            No live files in this period.
          </Typography>
        ) : (
          <>
            {loggedInConfigured ? (
              <Box sx={{ display: 'flex', gap: 1, mb: 1.75 }}>
                <SplitTile label='Before login' count={pulse.preLogin.count} amount={pulse.preLogin.amount} accent='warning' />
                <SplitTile label='Logged in' count={pulse.loggedIn.count} amount={pulse.loggedIn.amount} accent='info' />
              </Box>
            ) : (
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mb: 1.5 }}>
                Mark a Logged In stage in the pipeline to split the live book.
              </Typography>
            )}

            <Typography
              variant='caption'
              sx={{ fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: 'text.secondary', mb: 0.75 }}
            >
              Slowest stages
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
              {pulse.rows.map((row, idx) => (
                <Box
                  key={row.stageId}
                  sx={{
                    px: 0.25,
                    py: 0.35,
                    borderRadius: 1.5,
                    borderLeft: idx === 0 && row.avgIdleDays >= 7 ? '3px solid' : '3px solid transparent',
                    borderLeftColor: idx === 0 && row.avgIdleDays >= 7 ? 'warning.main' : 'transparent',
                    pl: 1
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
                    <Typography variant='subtitle2' noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
                      {row.stageName}
                    </Typography>
                    <Typography
                      variant='caption'
                      sx={{
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        color: row.avgIdleDays >= 14 ? 'error.main' : row.avgIdleDays >= 7 ? 'warning.main' : 'text.secondary'
                      }}
                    >
                      {row.avgIdleDays}d avg
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant='determinate'
                    value={Math.min(100, Math.round((row.avgIdleDays / maxIdle) * 100))}
                    sx={{ height: 4, borderRadius: 99, my: 0.5, bgcolor: 'action.hover' }}
                  />
                  <Typography variant='caption' color='text.secondary' noWrap sx={{ display: 'block' }}>
                    {[
                      `${row.count} file${row.count === 1 ? '' : 's'}`,
                      formatCompactINR(row.totalValue),
                      row.docsFiles > 0 ? `${row.docsFiles} with papers pending` : null,
                      row.isLoggedIn ? 'Logged in' : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Typography>
                </Box>
              ))}
            </Box>

            {pulse.slowest && pulse.slowest.avgIdleDays >= 7 ? (
              <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 1.25 }}>
                Bottleneck: {pulse.slowest.stageName} has sat the longest.
              </Typography>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
