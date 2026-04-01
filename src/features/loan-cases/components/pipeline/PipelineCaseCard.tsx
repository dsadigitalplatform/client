'use client'

import { memo, useMemo, useState } from 'react'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import MuiLink from '@mui/material/Link'

import { useDraggable } from '@dnd-kit/core'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'

type Props = {
  loanCase: LoanCaseListItem
  stageId: string
  stageColor: string
  stages?: { id: string; name: string }[]
  onMoveCaseStage?: (caseId: string, toStageId: string) => void
  dragDropEnabled: boolean
  dragging?: boolean
  canDrag?: boolean
  forOverlay?: boolean
}

const PipelineCaseCardView = ({
  loanCase,
  stageColor,
  stages = [],
  onMoveCaseStage,
  dragging,
  canDrag,
  forOverlay
}: Omit<Props, 'stageId' | 'dragDropEnabled'>) => {
  const pendingDocumentsCount = typeof loanCase.pendingDocumentsCount === 'number' ? loanCase.pendingDocumentsCount : 0
  const totalDocuments = typeof loanCase.totalDocuments === 'number' ? loanCase.totalDocuments : null
  const hasDocs = totalDocuments == null ? pendingDocumentsCount > 0 : totalDocuments > 0
  const showDocsChip = hasDocs
  const docsChipColor = pendingDocumentsCount > 0 ? 'warning' : 'success'
  const docsChipLabel = pendingDocumentsCount > 0 ? `Docs Pending (${pendingDocumentsCount})` : 'Docs OK'
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const moveOptions = useMemo(() => stages.filter(stage => stage.id !== loanCase.stageId), [loanCase.stageId, stages])
  const canMove = Boolean(loanCase.canMoveStage ?? true)
  const showMoveMenu = !forOverlay && canMove && moveOptions.length > 0 && Boolean(onMoveCaseStage)

  return (
    <Box
      sx={{
        touchAction: canDrag ? 'none' : 'auto',
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
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, flexShrink: 0 }}>
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
              {showMoveMenu && (
                <>
                  <IconButton
                    size='small'
                    aria-label='Move case stage'
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      setMenuAnchorEl(e.currentTarget)
                    }}
                  >
                    <i className='ri-more-2-fill' />
                  </IconButton>
                  <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={() => setMenuAnchorEl(null)}
                    onClick={e => e.stopPropagation()}
                  >
                    {moveOptions.map(stage => (
                      <MenuItem
                        key={stage.id}
                        onClick={() => {
                          setMenuAnchorEl(null)
                          onMoveCaseStage?.(loanCase.id, stage.id)
                        }}
                      >
                        {stage.name}
                      </MenuItem>
                    ))}
                  </Menu>
                </>
              )}
            </Box>
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

const PipelineCaseCard = ({
  loanCase,
  stageId,
  stageColor,
  stages,
  onMoveCaseStage,
  dragDropEnabled
}: Omit<Props, 'dragging' | 'canDrag' | 'forOverlay'>) => {
  const canMove = Boolean(loanCase.canMoveStage ?? true)
  const canDrag = canMove && dragDropEnabled

  const draggable = useDraggable({
    id: loanCase.id,
    data: { stageId },
    disabled: !canDrag
  })

  const dragging = draggable.isDragging

  return (
    <Box
      ref={canDrag ? draggable.setNodeRef : undefined}
      {...(canDrag ? draggable.listeners : {})}
      {...(canDrag ? draggable.attributes : {})}
    >
      <PipelineCaseCardView
        loanCase={loanCase}
        stageColor={stageColor}
        stages={stages}
        onMoveCaseStage={onMoveCaseStage}
        dragging={dragging}
        canDrag={canDrag}
      />
    </Box>
  )
}

export const PipelineCaseCardOverlay = ({ loanCase, stageColor }: { loanCase: LoanCaseListItem; stageColor: string }) => (
  <PipelineCaseCardView loanCase={loanCase} stageColor={stageColor} dragging={false} canDrag={false} forOverlay />
)

export default memo(PipelineCaseCard)
