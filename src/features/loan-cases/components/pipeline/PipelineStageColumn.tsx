'use client'

import { memo, useMemo } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'

import { useDroppable } from '@dnd-kit/core'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'

import PipelineCaseCard from './PipelineCaseCard'

export type PipelineStage = {
  id: string
  name: string
  order: number
}

type Props = {
  stage: PipelineStage
  stageColor: string
  caseIds: string[]
  casesById: Record<string, LoanCaseListItem>
}

const PipelineStageColumn = ({ stage, stageColor, caseIds, casesById }: Props) => {
  const droppable = useDroppable({ id: stage.id })

  const metrics = useMemo(() => {
    let total = 0

    caseIds.forEach(id => {
      const c = casesById[id]
      const amt = c?.requestedAmount

      if (typeof amt === 'number' && Number.isFinite(amt)) total += amt
    })

    return { count: caseIds.length, total }
  }, [caseIds, casesById])

  return (
    <Box
      sx={{
        width: { xs: '100%', sm: 332 },
        minWidth: { xs: '100%', sm: 332 },
        scrollSnapAlign: 'start'
      }}
    >
      <Card
        sx={{
          borderRadius: 4,
          backgroundColor: theme => theme.palette.background.default,
          border: '1px solid',
          borderColor: theme => theme.palette.divider,
          boxShadow: 1,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ px: 2, py: 1.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: stageColor, flex: '0 0 auto' }} />
              <Typography
                variant='subtitle1'
                sx={{
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {stage.name}
              </Typography>
            </Box>
            <Typography
              variant='caption'
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 999,
                backgroundColor: 'rgb(var(--mui-palette-primary-mainChannel) / 0.08)',
                fontWeight: 700,
                color: 'text.primary',
                flex: '0 0 auto'
              }}
            >
              {metrics.count}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
            <Typography variant='caption' color='text.secondary'>
              Total: ₹{metrics.total.toLocaleString('en-IN')}
            </Typography>
            <Box component='span' sx={{ color: 'text.disabled', display: 'inline-flex', alignItems: 'center' }}>
              <i className='ri-more-2-fill' />
            </Box>
          </Box>
        </Box>

        <Divider />

        <Box
          ref={droppable.setNodeRef}
          sx={{
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            minHeight: 140,
            backgroundColor: droppable.isOver ? 'rgb(var(--mui-palette-primary-mainChannel) / 0.06)' : 'transparent',
            transition: 'background-color .15s ease'
          }}
        >
          {caseIds.length === 0 ? (
            <Typography variant='body2' color='text.secondary' sx={{ py: 2, textAlign: 'center' }}>
              No cases
            </Typography>
          ) : (
            caseIds.map(caseId => {
              const loanCase = casesById[caseId]

              if (!loanCase) return null

              return <PipelineCaseCard key={loanCase.id} loanCase={loanCase} stageId={stage.id} stageColor={stageColor} />
            })
          )}
        </Box>
      </Card>
    </Box>
  )
}

export default memo(PipelineStageColumn)
