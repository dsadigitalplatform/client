'use client'

import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Chip from '@mui/material/Chip'

import { DATA_MODE_LABELS, type ReportDataMode } from '../reports.types'

type Props = {
  dataMode: ReportDataMode
  disclaimer: string | null
}

export default function ReportsDataModeBanner({ dataMode, disclaimer }: Props) {
  const info = DATA_MODE_LABELS[dataMode]
  const isHistorical = dataMode === 'historical'

  return (
    <Alert
      severity={isHistorical ? 'warning' : 'info'}
      icon={<i className={isHistorical ? 'ri-history-line' : 'ri-camera-line'} />}
      sx={{ alignItems: 'flex-start' }}
    >
      <AlertTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {info.title}
        <Chip
          size='small'
          label={isHistorical ? 'Audit-based' : 'Live data'}
          color={isHistorical ? 'warning' : 'info'}
          variant='outlined'
        />
      </AlertTitle>
      {disclaimer ?? info.description}
    </Alert>
  )
}
