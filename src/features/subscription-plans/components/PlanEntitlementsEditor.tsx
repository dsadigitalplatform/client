'use client'

import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import {
  LIMIT_FEATURES,
  MODULE_FEATURES,
  UNLIMITED,
  type PlanEntitlements
} from '@features/subscription-plans/featureCatalog'

type Props = {
  value: PlanEntitlements
  onChange: (next: PlanEntitlements) => void
}

export function PlanEntitlementsEditor({ value, onChange }: Props) {
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

  const setModule = (key: keyof PlanEntitlements['modules'], enabled: boolean) => {
    onChange({ ...value, modules: { ...value.modules, [key]: enabled } })
  }

  return (
    <Box className='flex flex-col gap-4'>
      <Box>
        <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
          Usage limits
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 1.5 }}>
          Use -1 for unlimited.
        </Typography>
        <Box className='grid grid-cols-1 sm:grid-cols-3 gap-3'>
          {LIMIT_FEATURES.map(f => (
            <TextField
              key={f.key}
              label={f.label}
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
        <Typography variant='subtitle1' sx={{ fontWeight: 600 }}>
          Modules
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
          Toggle features included in this plan.
        </Typography>
        <Box className='flex flex-col gap-1'>
          {MODULE_FEATURES.map(f => (
            <Box key={f.key} className='flex items-start justify-between gap-2'>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(value.modules[f.key])}
                    onChange={e => setModule(f.key, e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Box className='flex items-center gap-1 flex-wrap'>
                      <Typography variant='body2'>{f.label}</Typography>
                      {f.status === 'coming_soon' ? (
                        <Chip size='small' label='Watch this space' variant='outlined' color='warning' />
                      ) : null}
                    </Box>
                    <Typography variant='caption' color='text.secondary'>
                      {f.description}
                    </Typography>
                  </Box>
                }
              />
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
