'use client'

import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Avatar from '@mui/material/Avatar'
import Skeleton from '@mui/material/Skeleton'

type Accent = 'primary' | 'success' | 'info' | 'warning' | 'error' | 'secondary'

const accentMap: Record<Accent, { main: string; bg: string }> = {
  primary: { main: 'var(--mui-palette-primary-main)', bg: 'rgb(var(--mui-palette-primary-mainChannel) / 0.14)' },
  success: { main: 'var(--mui-palette-success-main)', bg: 'rgb(var(--mui-palette-success-mainChannel) / 0.14)' },
  info: { main: 'var(--mui-palette-info-main)', bg: 'rgb(var(--mui-palette-info-mainChannel) / 0.14)' },
  warning: { main: 'var(--mui-palette-warning-main)', bg: 'rgb(var(--mui-palette-warning-mainChannel) / 0.14)' },
  error: { main: 'var(--mui-palette-error-main)', bg: 'rgb(var(--mui-palette-error-mainChannel) / 0.14)' },
  secondary: { main: 'var(--mui-palette-secondary-main)', bg: 'rgb(var(--mui-palette-secondary-mainChannel) / 0.14)' }
}

type Props = {
  label: string
  value: ReactNode
  hint?: string
  icon: string
  accent?: Accent
  loading?: boolean
  footer?: ReactNode
  highlight?: boolean
}

export default function DashboardStatCard({
  label,
  value,
  hint,
  icon,
  accent = 'primary',
  loading,
  footer,
  highlight
}: Props) {
  const colors = accentMap[accent]

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: '1px solid',
        borderColor: highlight ? 'primary.main' : 'divider',
        background: highlight
          ? theme =>
              theme.palette.mode === 'dark'
                ? 'linear-gradient(145deg, rgb(var(--mui-palette-primary-mainChannel) / 0.18) 0%, var(--mui-palette-background-paper) 55%)'
                : 'linear-gradient(145deg, rgb(var(--mui-palette-primary-mainChannel) / 0.1) 0%, var(--mui-palette-background-paper) 55%)'
          : 'background.paper',
        boxShadow: highlight ? '0 12px 32px rgb(var(--mui-palette-primary-mainChannel) / 0.12)' : 'none',
        height: '100%'
      }}
    >
      <CardContent sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, flex: 1 }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant='caption' color='text.secondary' sx={{ fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase' }}>
              {label}
            </Typography>
            {loading ? (
              <Skeleton variant='text' width='60%' height={36} sx={{ mt: 0.5 }} />
            ) : (
              <Typography variant='h5' sx={{ fontWeight: 800, mt: 0.25, lineHeight: 1.2 }}>
                {value}
              </Typography>
            )}
            {hint ? (
              <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
                {hint}
              </Typography>
            ) : null}
          </Box>
          <Avatar sx={{ width: 44, height: 44, bgcolor: colors.bg, color: colors.main, flexShrink: 0 }}>
            <i className={icon} style={{ fontSize: '1.25rem' }} />
          </Avatar>
        </Box>
        {footer ? <Box sx={{ mt: 1.5 }}>{footer}</Box> : null}
      </CardContent>
    </Card>
  )
}
