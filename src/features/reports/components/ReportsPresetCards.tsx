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
  disabled?: boolean
}

export default function ReportsPresetCards({ onSelect, activePresetId, disabled = false }: Props) {
  const theme = useTheme()

  return (
    <Box>
      <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 1.5 }}>
        Quick start reports
      </Typography>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {REPORT_PRESETS.map(preset => {
          const active = activePresetId === preset.id

          return (
            <Grid key={preset.id} size={{ xs: 6, sm: 6, lg: 3 }}>
              <Card
                variant='outlined'
                sx={{
                  height: '100%',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                  opacity: disabled ? 0.7 : 1
                }}
              >
                <CardActionArea
                  onClick={() => {
                    if (!disabled) onSelect(preset)
                  }}
                  disabled={disabled}
                  sx={{ height: '100%' }}
                >
                  <CardContent
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: { xs: 0.75, sm: 1 },
                      p: { xs: 1.5, sm: 2.5 },
                      height: '100%'
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        flexDirection: { xs: 'column', sm: 'row' },
                        gap: { xs: 0.75, sm: 1 }
                      }}
                    >
                      <Box
                        sx={{
                          width: { xs: 32, sm: 36 },
                          height: { xs: 32, sm: 36 },
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: alpha(theme.palette.primary.main, 0.12),
                          color: 'primary.main',
                          flexShrink: 0
                        }}
                      >
                        <i className={preset.icon} style={{ fontSize: '1.1rem' }} />
                      </Box>
                      <Typography
                        variant='subtitle1'
                        fontWeight={700}
                        sx={{
                          fontSize: { xs: '0.875rem', sm: '1rem' },
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {preset.title}
                      </Typography>
                    </Box>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{
                        fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        display: '-webkit-box',
                        WebkitLineClamp: { xs: 3, sm: 2 },
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {preset.description}
                    </Typography>
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
