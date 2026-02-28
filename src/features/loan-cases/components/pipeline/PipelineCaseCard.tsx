'use client'

import { memo } from 'react'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import MuiLink from '@mui/material/Link'

import { useDraggable } from '@dnd-kit/core'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'

type Props = {
  loanCase: LoanCaseListItem
  stageId: string
  stageColor: string
  dragging?: boolean
  canDrag?: boolean
  forOverlay?: boolean
}

const PipelineCaseCardView = ({ loanCase, stageColor, dragging, canDrag, forOverlay }: Omit<Props, 'stageId'>) => {
  const pendingDocumentsCount = typeof loanCase.pendingDocumentsCount === 'number' ? loanCase.pendingDocumentsCount : 0
  const totalDocuments = typeof loanCase.totalDocuments === 'number' ? loanCase.totalDocuments : null
  const hasDocs = totalDocuments == null ? pendingDocumentsCount > 0 : totalDocuments > 0
  const showDocsChip = hasDocs
  const docsChipColor = pendingDocumentsCount > 0 ? 'warning' : 'success'
  const docsChipLabel = pendingDocumentsCount > 0 ? `Docs Pending (${pendingDocumentsCount})` : 'Docs OK'

  return (
    <Box
      sx={{
        touchAction: 'none',
        opacity: dragging ? 0.2 : 1,
        cursor: canDrag ? (dragging ? 'grabbing' : 'grab') : 'default',
        pointerEvents: forOverlay ? 'none' : 'auto',
        width: forOverlay ? 320 : 'auto',
        maxWidth: forOverlay ? 360 : 'none'
      }}
    >
      <Card
        sx={{
          borderRadius: 3,
          borderLeft: `4px solid ${stageColor}`,
          boxShadow: forOverlay ? 14 : 3,
          transform: forOverlay ? 'rotate(1deg) scale(1.02)' : undefined,
          transition: 'box-shadow .18s ease, transform .18s ease, opacity .18s ease',
          backgroundColor: dragging ? 'action.hover' : 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          '&:hover': { boxShadow: canDrag ? 8 : 3 }
        }}
      >
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <MuiLink
                component={Link}
                href={`/loan-cases/${loanCase.id}`}
                underline='hover'
                color='text.primary'
                sx={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  display: 'block',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  whiteSpace: 'nowrap'
                }}
              >
                {loanCase.customerName || 'Customer'}
              </MuiLink>
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.25 }}>
                {loanCase.loanTypeName || 'Loan Type'} {loanCase.bankName ? `• ${loanCase.bankName}` : ''}
              </Typography>
            </Box>
            {showDocsChip && (
              <Chip
                size='small'
                color={docsChipColor}
                label={docsChipLabel}
                sx={{
                  fontWeight: 700,
                  '& .MuiChip-label': { px: 1.1 }
                }}
              />
            )}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0.5, mt: 1.25 }}>
            <Typography variant='body2' sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <span>Requested</span>
              <span>{typeof loanCase.requestedAmount === 'number' ? '₹' + loanCase.requestedAmount.toLocaleString('en-IN') : '—'}</span>
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
              <span>Agent</span>
              <span>{loanCase.assignedAgentName || loanCase.assignedAgentEmail || '—'}</span>
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}

const PipelineCaseCard = ({ loanCase, stageId, stageColor }: Omit<Props, 'dragging' | 'canDrag' | 'forOverlay'>) => {
  const draggable = useDraggable({
    id: loanCase.id,
    data: { stageId }
  })

  const dragging = draggable.isDragging
  const canDrag = Boolean(loanCase.canMoveStage ?? true)

  return (
    <Box
      ref={canDrag ? draggable.setNodeRef : undefined}
      {...(canDrag ? draggable.listeners : {})}
      {...(canDrag ? draggable.attributes : {})}
    >
      <PipelineCaseCardView loanCase={loanCase} stageColor={stageColor} dragging={dragging} canDrag={canDrag} />
    </Box>
  )
}

export const PipelineCaseCardOverlay = ({ loanCase, stageColor }: { loanCase: LoanCaseListItem; stageColor: string }) => (
  <PipelineCaseCardView loanCase={loanCase} stageColor={stageColor} dragging={false} canDrag={false} forOverlay />
)

export default memo(PipelineCaseCard)
