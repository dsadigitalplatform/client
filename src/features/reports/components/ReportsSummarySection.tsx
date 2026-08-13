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

const baseCards = [
  { key: 'cases', label: 'Total cases', icon: 'ri-briefcase-4-line' },
  { key: 'amount', label: 'Total amount', icon: 'ri-money-rupee-circle-line' },
  { key: 'customers', label: 'Unique customers', icon: 'ri-user-line' }
] as const

const disbursementCards = [
  { key: 'disbursed', label: 'Total disbursed', icon: 'ri-funds-line' },
  { key: 'remaining', label: 'Balance remaining', icon: 'ri-wallet-3-line' },
  { key: 'tracked', label: 'Trackers', icon: 'ri-pie-chart-2-line' }
] as const

export default function ReportsSummarySection({ summary }: Props) {
  const theme = useTheme()
  const hasDisbursement = Boolean(summary.disbursementTrackedCases)

  const baseValues: Record<(typeof baseCards)[number]['key'], string> = {
    cases: String(summary.totalCases),
    amount: formatINR(summary.totalAmount),
    customers: String(summary.uniqueCustomers)
  }

  const disbursementValues: Record<(typeof disbursementCards)[number]['key'], string> = {
    disbursed: formatINR(summary.totalDisbursedAmount ?? 0),
    remaining: formatINR(summary.totalRemainingAmount ?? 0),
    tracked: [
      `${summary.disbursementTrackedCases ?? 0} tracked`,
      summary.disbursementPartial ? `${summary.disbursementPartial} partial` : null,
      summary.disbursementCompleted ? `${summary.disbursementCompleted} done` : null,
      summary.disbursementPending ? `${summary.disbursementPending} pending` : null
    ]
      .filter(Boolean)
      .join(' · ')
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Grid container spacing={2}>
        {baseCards.map(card => (
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
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant='body2' color='text.secondary'>
                    {card.label}
                  </Typography>
                  <Typography variant='h5' fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                    {baseValues[card.key]}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {hasDisbursement ? (
        <Grid container spacing={2}>
          {disbursementCards.map(card => (
            <Grid key={card.key} size={{ xs: 12, sm: 4 }}>
              <Card
                variant='outlined'
                sx={{
                  height: '100%',
                  borderColor: alpha(theme.palette.success.main, 0.35),
                  bgcolor: alpha(theme.palette.success.main, 0.04)
                }}
              >
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: alpha(theme.palette.success.main, 0.12),
                      color: 'success.main',
                      flexShrink: 0
                    }}
                  >
                    <i className={card.icon} style={{ fontSize: '1.25rem' }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant='body2' color='text.secondary'>
                      {card.label}
                    </Typography>
                    <Typography
                      variant={card.key === 'tracked' ? 'subtitle1' : 'h5'}
                      fontWeight={700}
                      sx={{ wordBreak: 'break-word' }}
                    >
                      {disbursementValues[card.key]}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : null}
    </Box>
  )
}
