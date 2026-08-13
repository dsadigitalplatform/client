'use client'

import { useMemo } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'

import type { PipelineStage } from './PipelineStageColumn'
import PipelineCaseRow from './PipelineCaseRow'

type Props = {
  stages: PipelineStage[]
  caseIdsByStage: Record<string, string[]>
  casesById: Record<string, LoanCaseListItem>
  stageColorById: Record<string, string>
  focusedStageId: string
  onFocusStage: (stageId: string) => void
  onMoveCaseStage: (caseId: string, toStageId: string) => void
}

const formatINRCompact = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(Number.isFinite(amount) ? amount : 0)

export default function PipelineFocusWorkspace({
  stages,
  caseIdsByStage,
  casesById,
  stageColorById,
  focusedStageId,
  onFocusStage,
  onMoveCaseStage
}: Props) {
  const theme = useTheme()

  const stageMetrics = useMemo(() => {
    return stages.map(stage => {
      const ids = caseIdsByStage[stage.id] || []
      const total = ids.reduce((acc, id) => {
        const c = casesById[id]

        return acc + (c ? resolveApprovedAmount(c) ?? 0 : 0)
      }, 0)

      return { stage, count: ids.length, total }
    })
  }, [stages, caseIdsByStage, casesById])

  const maxCount = Math.max(1, ...stageMetrics.map(m => m.count))
  const focused = stageMetrics.find(m => m.stage.id === focusedStageId) || stageMetrics[0]
  const focusedIds = focused ? caseIdsByStage[focused.stage.id] || [] : []
  const focusedColor = focused ? stageColorById[focused.stage.id] || theme.palette.primary.main : theme.palette.primary.main
  const focusedIndex = stages.findIndex(s => s.id === focused?.stage.id)
  const prevStage = focusedIndex > 0 ? stages[focusedIndex - 1] : null
  const nextStage = focusedIndex >= 0 && focusedIndex < stages.length - 1 ? stages[focusedIndex + 1] : null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Card
        variant='outlined'
        sx={{
          borderRadius: 3,
          p: { xs: 1.25, sm: 1.5 },
          overflow: 'hidden'
        }}
      >
        <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 700, letterSpacing: 0.3, mb: 1, display: 'block' }}>
          Pipeline distribution · click a stage to focus
        </Typography>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(3, 1fr)',
              lg: 'repeat(4, 1fr)',
              xl: 'repeat(5, 1fr)'
            },
            gap: 1
          }}
        >
          {stageMetrics.map(({ stage, count, total }) => {
            const selected = stage.id === focused?.stage.id
            const color = stageColorById[stage.id] || theme.palette.primary.main
            const share = count / maxCount

            return (
              <Box
                key={stage.id}
                component='button'
                type='button'
                onClick={() => onFocusStage(stage.id)}
                sx={{
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: selected ? color : 'divider',
                  borderRadius: 2,
                  px: 1.25,
                  py: 1,
                  backgroundColor: selected ? alpha(color, theme.palette.mode === 'dark' ? 0.2 : 0.1) : 'background.paper',
                  transition: 'border-color .15s ease, background-color .15s ease, box-shadow .15s ease',
                  boxShadow: selected ? `inset 3px 0 0 ${color}` : 'none',
                  '&:hover': {
                    borderColor: color,
                    backgroundColor: alpha(color, theme.palette.mode === 'dark' ? 0.16 : 0.06)
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                  <Typography
                    variant='body2'
                    sx={{
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0
                    }}
                    title={stage.name}
                  >
                    {stage.name}
                  </Typography>
                  <Typography variant='caption' sx={{ fontWeight: 800, flexShrink: 0 }}>
                    {count}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: 'action.hover',
                    overflow: 'hidden',
                    mb: 0.5
                  }}
                >
                  <Box sx={{ width: `${Math.round(share * 100)}%`, height: '100%', backgroundColor: color, borderRadius: 999 }} />
                </Box>
                <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600 }}>
                  {formatINRCompact(total)}
                </Typography>
              </Box>
            )
          })}
        </Box>
      </Card>

      <Card variant='outlined' sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 1.25,
            px: { xs: 1.5, sm: 2 },
            py: 1.5,
            borderBottom: '1px solid',
            borderColor: 'divider',
            background: `linear-gradient(90deg, ${alpha(focusedColor, theme.palette.mode === 'dark' ? 0.18 : 0.1)} 0%, transparent 70%)`
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: focusedColor, flexShrink: 0 }} />
              <Typography variant='h6' sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {focused?.stage.name || 'Stage'}
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 700 }}>
                {focused?.count || 0} {(focused?.count || 0) === 1 ? 'case' : 'cases'}
              </Typography>
            </Box>
            <Typography variant='body2' color='text.secondary' sx={{ mt: 0.35 }}>
              Approved value {formatINRCompact(focused?.total || 0)} · move cases with the action on each row
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              size='small'
              variant='outlined'
              disabled={!prevStage}
              onClick={() => prevStage && onFocusStage(prevStage.id)}
              startIcon={<i className='ri-arrow-left-s-line' />}
            >
              {prevStage?.name || 'Prev'}
            </Button>
            <Button
              size='small'
              variant='outlined'
              disabled={!nextStage}
              onClick={() => nextStage && onFocusStage(nextStage.id)}
              endIcon={<i className='ri-arrow-right-s-line' />}
            >
              {nextStage?.name || 'Next'}
            </Button>
          </Box>
        </Box>

        <Box sx={{ p: { xs: 1.25, sm: 1.5 }, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {focusedIds.length === 0 ? (
            <Typography variant='body2' color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
              No cases in this stage for the current filters.
            </Typography>
          ) : (
            focusedIds.map(id => {
              const loanCase = casesById[id]

              if (!loanCase) return null

              return (
                <PipelineCaseRow
                  key={id}
                  loanCase={loanCase}
                  stageColor={focusedColor}
                  stages={stages}
                  onMoveCaseStage={onMoveCaseStage}
                />
              )
            })
          )}
        </Box>
      </Card>
    </Box>
  )
}
