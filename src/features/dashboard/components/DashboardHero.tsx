'use client'

import { useMemo } from 'react'

import Link from 'next/link'

import Autocomplete from '@mui/material/Autocomplete'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import type { TenantUserOption } from '@features/loan-cases/loan-cases.types'
import DashboardHeroPeriodControls from '@features/dashboard/components/DashboardPeriodBar'
import type { DashboardTimePeriod } from '@features/dashboard/utils/timelineBuckets'

type AgentOption = { id: string; label: string; email: string | null }

type Props = {
  tenantName?: string
  userName?: string
  tenantRole?: 'OWNER' | 'ADMIN' | 'USER'
  agents: TenantUserOption[]
  viewingAgentId: string
  onAgentChange: (agentId: string) => void
  isViewingAllAgents: boolean
  period?: DashboardTimePeriod
  onPeriodChange?: (period: DashboardTimePeriod) => void
  periodDisabled?: boolean
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'

  return 'Good evening'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  return parts
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase())
    .join('')
}

const HERO_FILTER_WIDTH = 300

export default function DashboardHero({
  tenantName,
  userName,
  tenantRole,
  agents,
  viewingAgentId,
  onAgentChange,
  isViewingAllAgents,
  period,
  onPeriodChange,
  periodDisabled
}: Props) {
  const theme = useTheme()
  const canPickAgent = tenantRole === 'ADMIN' || tenantRole === 'OWNER'

  const agentOptions = useMemo<AgentOption[]>(() => {
    const sorted = agents.slice().sort((a, b) => a.name.localeCompare(b.name))
    const mapped = sorted.map(u => ({
      id: u.id,
      label: u.name || u.email || u.id,
      email: u.email
    }))

    if (canPickAgent) return [{ id: '', label: 'All agents', email: null }, ...mapped]

    return mapped
  }, [agents, canPickAgent])

  const selectedOption = agentOptions.find(o => o.id === viewingAgentId) ?? agentOptions[0] ?? null

  const greeting = useMemo(() => greetingForHour(new Date().getHours()), [])

  const subtitle = isViewingAllAgents
    ? 'Organisation-wide performance snapshot'
    : selectedOption?.id
      ? `Performance for ${selectedOption.label}`
      : 'Your pipeline at a glance'

  return (
    <Box
      sx={{
        borderRadius: 4,
        p: { xs: 2.5, md: 3.5 },
        position: 'relative',
        overflow: 'hidden',
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.35)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 48%, ${alpha(theme.palette.secondary.main, 0.2)} 100%)`
            : `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.92)} 0%, ${alpha(theme.palette.primary.dark, 0.78)} 42%, ${alpha(theme.palette.info.main, 0.55)} 100%)`,
        color: 'common.white',
        boxShadow: '0 20px 48px rgb(var(--mui-palette-primary-mainChannel) / 0.28)'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          width: 220,
          height: 220,
          borderRadius: '50%',
          top: -80,
          right: -40,
          background: 'rgb(255 255 255 / 0.08)',
          pointerEvents: 'none'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          width: 140,
          height: 140,
          borderRadius: '50%',
          bottom: -50,
          left: -30,
          background: 'rgb(255 255 255 / 0.06)',
          pointerEvents: 'none'
        }}
      />

      <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', lg: 'row' },
            alignItems: { xs: 'stretch', lg: 'flex-start' },
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Chip
              size='small'
              label={tenantName || 'Your workspace'}
              sx={{
                mb: 1.25,
                bgcolor: 'rgb(255 255 255 / 0.16)',
                color: 'inherit',
                fontWeight: 600,
                border: '1px solid rgb(255 255 255 / 0.22)'
              }}
            />
            <Typography variant='h4' sx={{ fontWeight: 800, lineHeight: 1.15 }}>
              {greeting}
              {userName ? `, ${userName.split(' ')[0]}` : ''}
            </Typography>
            <Typography variant='body1' sx={{ mt: 0.75, opacity: 0.92, maxWidth: 520 }}>
              {subtitle}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              width: { xs: '100%', sm: HERO_FILTER_WIDTH },
              maxWidth: { xs: '100%', sm: HERO_FILTER_WIDTH },
              flexShrink: 0,
              alignSelf: { xs: 'stretch', sm: 'flex-end' },
              ml: { sm: 'auto' }
            }}
          >
            {canPickAgent ? (
              <Autocomplete
                size='small'
                options={agentOptions}
                value={selectedOption}
                onChange={(_, value) => onAgentChange(value?.id ?? '')}
                getOptionLabel={o => o.label}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                sx={{
                  width: HERO_FILTER_WIDTH,
                  maxWidth: '100%',
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgb(255 255 255 / 0.14)',
                    color: 'common.white',
                    borderRadius: 2.5,
                    '& fieldset': { borderColor: 'rgb(255 255 255 / 0.28)' },
                    '&:hover fieldset': { borderColor: 'rgb(255 255 255 / 0.45)' },
                    '&.Mui-focused fieldset': { borderColor: 'rgb(255 255 255 / 0.65)' }
                  },
                  '& .MuiInputLabel-root': { color: 'rgb(255 255 255 / 0.75)' },
                  '& .MuiSvgIcon-root': { color: 'rgb(255 255 255 / 0.85)' }
                }}
                renderInput={params => <TextField {...params} label='View dashboard for' />}
                renderOption={(props, option) => (
                  <Box component='li' {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem' }}>
                      {option.id ? initials(option.label) : <i className='ri-team-line' />}
                    </Avatar>
                    <Box>
                      <Typography variant='body2' fontWeight={600}>
                        {option.label}
                      </Typography>
                      {option.email ? (
                        <Typography variant='caption' color='text.secondary'>
                          {option.email}
                        </Typography>
                      ) : null}
                    </Box>
                  </Box>
                )}
              />
            ) : (
              <Chip
                icon={<i className='ri-user-star-line' />}
                label='My portfolio'
                sx={{ alignSelf: 'flex-start', bgcolor: 'rgb(255 255 255 / 0.16)', color: 'inherit' }}
              />
            )}

            {period && onPeriodChange ? (
              <DashboardHeroPeriodControls
                period={period}
                onPeriodChange={onPeriodChange}
                disabled={periodDisabled}
              />
            ) : null}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
          <Button
            component={Link}
            href='/loan-cases'
            variant='contained'
            size='small'
            startIcon={<i className='ri-briefcase-4-line' />}
            sx={{
              bgcolor: 'rgb(255 255 255 / 0.95)',
              color: 'primary.dark',
              '&:hover': { bgcolor: 'common.white' }
            }}
          >
            Lead manager
          </Button>
          <Button
            component={Link}
            href='/progressive-disbursements'
            variant='outlined'
            size='small'
            startIcon={<i className='ri-funds-line' />}
            sx={{ borderColor: 'rgb(255 255 255 / 0.5)', color: 'inherit', '&:hover': { borderColor: 'common.white', bgcolor: 'rgb(255 255 255 / 0.1)' } }}
          >
            Disbursements
          </Button>
          <Button
            component={Link}
            href='/appointments'
            variant='outlined'
            size='small'
            startIcon={<i className='ri-calendar-check-line' />}
            sx={{ borderColor: 'rgb(255 255 255 / 0.5)', color: 'inherit', '&:hover': { borderColor: 'common.white', bgcolor: 'rgb(255 255 255 / 0.1)' } }}
          >
            Follow-ups
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
