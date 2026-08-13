'use client'

import Link from 'next/link'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'

type Props = {
  planName: string
  statusMessage?: string | null
  canManage?: boolean
}

export default function SubscriptionPlanChip({ planName, statusMessage, canManage }: Props) {
  const tooltipTitle = (
    <Box sx={{ py: 0.25, maxWidth: 240, color: 'common.white' }}>
      <Box component='span' sx={{ display: 'block', fontWeight: 700, fontSize: '0.75rem', lineHeight: 1.35 }}>
        {planName}
      </Box>
      {statusMessage ? (
        <Box component='span' sx={{ display: 'block', mt: 0.35, fontSize: '0.75rem', lineHeight: 1.4, opacity: 0.95 }}>
          {statusMessage}
        </Box>
      ) : null}
      {canManage ? (
        <Box component='span' sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem', lineHeight: 1.35, opacity: 0.8 }}>
          Click for Subscription & Billing
        </Box>
      ) : null}
    </Box>
  )

  const chip = (
    <Chip
      {...(canManage
        ? {
            component: Link,
            href: '/admin/subscription',
            clickable: true
          }
        : {})}
      size='small'
      color='primary'
      label={
        <Typography variant='subtitle2' noWrap>
          {planName}
        </Typography>
      }
      icon={<i className='ri-vip-crown-line' />}
      sx={canManage ? { cursor: 'pointer' } : undefined}
    />
  )

  return (
    <Tooltip
      title={tooltipTitle}
      arrow
      enterDelay={200}
      slotProps={{
        tooltip: {
          sx: {
            bgcolor: 'rgba(33, 33, 33, 0.95)',
            color: 'common.white',
            px: 1.25,
            py: 0.75,
            maxWidth: 260,
            '& .MuiTooltip-arrow': { color: 'rgba(33, 33, 33, 0.95)' }
          }
        }
      }}
    >
      <Box component='span' sx={{ display: 'inline-flex', maxWidth: 160 }}>
        {chip}
      </Box>
    </Tooltip>
  )
}
