'use client'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import {
  LIMIT_FEATURES,
  MODULE_FEATURES,
  UNLIMITED,
  modulesByCategory,
  type ModuleFeatureKey,
  type PlanEntitlements,
  type PlanModules
} from '@features/subscription-plans/featureCatalog'

type Props = {
  value: PlanEntitlements
  onChange: (next: PlanEntitlements) => void
}

export function PlanEntitlementsEditor({ value, onChange }: Props) {
  const theme = useTheme()
  const groups = modulesByCategory()
  const enabledCount = MODULE_FEATURES.filter(f => value.modules[f.key]).length

  const setLimit = (key: keyof PlanEntitlements['limits'], raw: string) => {
    const trimmed = raw.trim()

    if (trimmed === '' || trimmed === '-1') {
      onChange({ ...value, limits: { ...value.limits, [key]: UNLIMITED } })

      return
    }

    const n = Number(trimmed)

    if (!Number.isFinite(n)) return
    onChange({ ...value, limits: { ...value.limits, [key]: Math.max(0, Math.trunc(n)) } })
  }

  const setModule = (key: ModuleFeatureKey, enabled: boolean) => {
    onChange({ ...value, modules: { ...value.modules, [key]: enabled } })
  }

  const setModules = (patch: Partial<PlanModules>) => {
    onChange({ ...value, modules: { ...value.modules, ...patch } })
  }

  const setAllModules = (enabled: boolean) => {
    setModules(Object.fromEntries(MODULE_FEATURES.map(f => [f.key, enabled])) as PlanModules)
  }

  return (
    <Box className='flex flex-col gap-4'>
      <Box>
        <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
          Usage limits
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
          Use -1 for unlimited. Seats are a standing total. Customers and leads reset at the start of each month.
        </Typography>
        <Box className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          {LIMIT_FEATURES.map(f => (
            <TextField
              key={f.key}
              label={`${f.label} (${f.reset === 'monthly' ? 'per month' : 'total'})`}
              type='number'
              helperText={f.description}
              value={value.limits[f.key]}
              onChange={e => setLimit(f.key, e.target.value)}
              fullWidth
            />
          ))}
        </Box>
      </Box>

      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            justifyContent: 'space-between',
            gap: 1.5,
            flexDirection: { xs: 'column', sm: 'row' },
            mb: 1.5
          }}
        >
          <Box>
            <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
              Included features
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              Choose which capabilities this plan unlocks. {enabledCount} of {MODULE_FEATURES.length} selected.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button size='small' variant='outlined' onClick={() => setAllModules(true)}>
              Select all
            </Button>
            <Button size='small' variant='text' onClick={() => setAllModules(false)} disabled={enabledCount === 0}>
              Clear
            </Button>
          </Box>
        </Box>

        <Box className='flex flex-col gap-3.5'>
          {groups.map(group => {
            const selectedInGroup = group.features.filter(f => value.modules[f.key]).length
            const allOn = selectedInGroup === group.features.length

            return (
              <Box
                key={group.key}
                sx={{
                  p: 1.75,
                  borderRadius: 2.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: alpha(theme.palette.primary.main, 0.02)
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1,
                    mb: 1.5
                  }}
                >
                  <Box>
                    <Typography variant='subtitle2' sx={{ fontWeight: 700 }}>
                      {group.label}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {group.description} · {selectedInGroup}/{group.features.length} included
                    </Typography>
                  </Box>
                  <Button
                    size='small'
                    variant='text'
                    onClick={() =>
                      setModules(Object.fromEntries(group.features.map(f => [f.key, !allOn])) as Partial<PlanModules>)
                    }
                  >
                    {allOn ? 'Clear group' : 'Select group'}
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                    gap: 1.25
                  }}
                >
                  {group.features.map(f => {
                    const on = Boolean(value.modules[f.key])
                    const comingSoon = f.status === 'coming_soon'
                    const tone = comingSoon
                      ? theme.palette.warning.main
                      : on
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary

                    return (
                      <Box
                        key={f.key}
                        role='checkbox'
                        aria-checked={on}
                        tabIndex={0}
                        onClick={() => setModule(f.key, !on)}
                        onKeyDown={e => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault()
                            setModule(f.key, !on)
                          }
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 1.25,
                          p: 1.25,
                          borderRadius: 2,
                          cursor: 'pointer',
                          userSelect: 'none',
                          bgcolor: on ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                          border: '1px solid',
                          borderColor: on
                            ? alpha(theme.palette.primary.main, 0.45)
                            : comingSoon
                              ? alpha(theme.palette.warning.main, 0.35)
                              : 'divider',
                          transition: theme.transitions.create(['border-color', 'background-color', 'box-shadow'], {
                            duration: theme.transitions.duration.shorter
                          }),
                          '&:hover': {
                            borderColor: comingSoon ? 'warning.main' : 'primary.main',
                            boxShadow: `0 0 0 1px ${alpha(tone, 0.12)}`
                          },
                          '&:focus-visible': {
                            outline: `2px solid ${theme.palette.primary.main}`,
                            outlineOffset: 2
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                            bgcolor: alpha(tone, 0.12),
                            color: tone
                          }}
                        >
                          <i className={f.icon} style={{ fontSize: 18, lineHeight: 1 }} />
                        </Box>
                        <Box sx={{ minWidth: 0, flex: 1, pt: 0.15 }}>
                          <Box className='flex items-center gap-1 flex-wrap'>
                            <Typography variant='body2' sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                              {f.label}
                            </Typography>
                            {comingSoon ? (
                              <Chip size='small' label='Watch this space' variant='outlined' color='warning' />
                            ) : null}
                          </Box>
                          <Typography variant='caption' color='text.secondary' sx={{ display: 'block', mt: 0.35, lineHeight: 1.45 }}>
                            {f.description}
                          </Typography>
                        </Box>
                        <Checkbox
                          checked={on}
                          tabIndex={-1}
                          disableRipple
                          onClick={e => e.stopPropagation()}
                          onChange={e => setModule(f.key, e.target.checked)}
                          sx={{ p: 0.25, mt: -0.25, flexShrink: 0 }}
                        />
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )
          })}
        </Box>
      </Box>
    </Box>
  )
}
