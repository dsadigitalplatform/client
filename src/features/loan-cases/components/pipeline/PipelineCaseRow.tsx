'use client'

import { memo, useMemo, useState } from 'react'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'

import type { LoanCaseListItem } from '@features/loan-cases/loan-cases.types'
import { LeadIdentity } from '@features/loan-cases/components/LeadCodeDisplay'
import { resolveApprovedAmount } from '@features/loan-disbursements/utils/disbursementCalculations'

type Props = {
  loanCase: LoanCaseListItem
  stageColor: string
  stages: { id: string; name: string }[]
  onMoveCaseStage: (caseId: string, toStageId: string) => void
}

const PipelineCaseRow = ({ loanCase, stageColor, stages, onMoveCaseStage }: Props) => {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
  const moveOptions = useMemo(() => stages.filter(stage => stage.id !== loanCase.stageId), [loanCase.stageId, stages])
  const canMove = Boolean(loanCase.canMoveStage ?? true)
  const showMoveMenu = canMove && moveOptions.length > 0
  const approvedAmount = resolveApprovedAmount(loanCase)
  const pendingDocumentsCount = typeof loanCase.pendingDocumentsCount === 'number' ? loanCase.pendingDocumentsCount : 0

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr auto',
          sm: 'minmax(0, 1.2fr) minmax(0, 1fr) minmax(96px, 0.7fr) auto'
        },
        alignItems: 'center',
        gap: { xs: 1, sm: 1.5 },
        px: 1.5,
        py: 1.15,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `3px solid ${stageColor}`,
        backgroundColor: 'background.paper',
        '&:hover': { backgroundColor: 'action.hover' }
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <LeadIdentity
          customerName={loanCase.customerName}
          code={loanCase.code}
          href={`/loan-cases/${loanCase.id}`}
          subtitle={`${loanCase.loanTypeName || 'Loan Type'}${loanCase.bankName ? ` · ${loanCase.bankName}` : ''}`}
        />
        <Box sx={{ display: { xs: 'flex', sm: 'none' }, alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
          <Typography variant='caption' sx={{ fontWeight: 700 }}>
            {typeof approvedAmount === 'number' ? `₹${approvedAmount.toLocaleString('en-IN')}` : '—'}
          </Typography>
          {pendingDocumentsCount > 0 ? (
            <Chip size='small' color='warning' label={`${pendingDocumentsCount} docs`} sx={{ height: 20, fontWeight: 700 }} />
          ) : null}
        </Box>
      </Box>

      <Typography
        variant='body2'
        color='text.secondary'
        noWrap
        sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 0 }}
        title={loanCase.assignedAgentName || loanCase.assignedAgentEmail || ''}
      >
        {loanCase.assignedAgentName || loanCase.assignedAgentEmail || 'Unassigned'}
      </Typography>

      <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'flex-end', gap: 1, minWidth: 0 }}>
        {pendingDocumentsCount > 0 ? (
          <Chip size='small' color='warning' label={`${pendingDocumentsCount} docs`} sx={{ height: 22, fontWeight: 700 }} />
        ) : null}
        <Typography variant='body2' sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
          {typeof approvedAmount === 'number' ? `₹${approvedAmount.toLocaleString('en-IN')}` : '—'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        {showMoveMenu ? (
          <>
            <IconButton
              size='small'
              aria-label='Move case stage'
              onClick={e => setMenuAnchorEl(e.currentTarget)}
            >
              <i className='ri-arrow-right-up-line' />
            </IconButton>
            <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
              {moveOptions.map(stage => (
                <MenuItem
                  key={stage.id}
                  onClick={() => {
                    setMenuAnchorEl(null)
                    onMoveCaseStage(loanCase.id, stage.id)
                  }}
                >
                  {stage.name}
                </MenuItem>
              ))}
            </Menu>
          </>
        ) : null}
      </Box>
    </Box>
  )
}

export default memo(PipelineCaseRow)
