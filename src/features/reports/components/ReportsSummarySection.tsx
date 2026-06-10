'use client'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import { alpha, useTheme } from '@mui/material/styles'

import type { ReportSummary } from '../reports.types'
import { formatINR } from '../utils/exportReport'

type Props = {
  summary: ReportSummary
}

const cards = [
  { key: 'cases', label: 'Total cases', icon: 'ri-briefcase-4-line' },
  { key: 'amount', label: 'Total amount', icon: 'ri-money-rupee-circle-line' },
  { key: 'customers', label: 'Unique customers', icon: 'ri-user-line' }
] as const

export default function ReportsSummarySection({ summary }: Props) {
  const theme = useTheme()

  const values: Record<(typeof cards)[number]['key'], string> = {
    cases: String(summary.totalCases),
    amount: formatINR(summary.totalAmount),
    customers: String(summary.uniqueCustomers)
  }

  return (
    <Grid container spacing={2}>
      {cards.map(card => (
        <Grid key={card.key} size={{ xs: 12, sm: 4 }}>
          <Card variant='outlined' sx={{ height: '100%' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  flexShrink: 0
                }}
              >
                <i className={card.icon} style={{ fontSize: '1.25rem' }} />
              </Box>
              <Box>
                <Typography variant='body2' color='text.secondary'>
                  {card.label}
                </Typography>
                <Typography variant='h5' fontWeight={700}>
                  {values[card.key]}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}
