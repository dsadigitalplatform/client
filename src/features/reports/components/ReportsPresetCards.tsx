'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import { REPORT_PRESETS, type ReportPreset } from '../reports.types'

type Props = {
  onSelect: (preset: ReportPreset) => void
  activePresetId?: string | null
}

export default function ReportsPresetCards({ onSelect, activePresetId }: Props) {
  const theme = useTheme()

  return (
    <Box>
      <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1.5 }}>
        Quick start reports
      </Typography>
      <Grid container spacing={2}>
        {REPORT_PRESETS.map(preset => {
          const active = activePresetId === preset.id

          return (
            <Grid key={preset.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card
                variant='outlined'
                sx={{
                  height: '100%',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? alpha(theme.palette.primary.main, 0.06) : 'background.paper'
                }}
              >
                <CardActionArea onClick={() => onSelect(preset)} sx={{ height: '100%' }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          color: 'primary.main'
                        }}
                      >
                        <i className={preset.icon} style={{ fontSize: '1.1rem' }} />
                      </Box>
                      <Typography variant='subtitle1' fontWeight={700}>
                        {preset.title}
                      </Typography>
                    </Box>
                    <Typography variant='body2' color='text.secondary'>
                      {preset.description}
                    </Typography>
                    {preset.filters.dataMode === 'historical' ? (
                      <Typography variant='caption' sx={{ color: 'warning.main', fontWeight: 600 }}>
                        Uses audit history
                      </Typography>
                    ) : null}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
