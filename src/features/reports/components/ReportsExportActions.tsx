'use client'

import { useEffect, useState } from 'react'

import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

import type { ReportExportMeta, ReportQueryResponse } from '../reports.types'
import { exportReportExcel, exportReportHtml, groupByLabel, printReportPdf } from '../utils/exportReport'
import { resolveReportCharts } from '../utils/resolveReportCharts'
import { fetchProfileName, fetchSessionTenant } from '../services/reportsService'

type Props = {
  data: ReportQueryResponse | null
}

export default function ReportsExportActions({ data }: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [meta, setMeta] = useState<Omit<ReportExportMeta, 'reportTitle'> | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void (async () => {
      const [tenant, profileName] = await Promise.all([fetchSessionTenant(), fetchProfileName()])

      setMeta({
        organisationName: tenant?.tenantName ?? 'Organisation',
        preparedBy: profileName ?? 'User',
        preparedAt: new Date().toLocaleString(undefined, {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        dataMode: data?.dataMode ?? 'snapshot',
        disclaimer: data?.disclaimer ?? null
      })
    })()
  }, [data?.dataMode, data?.disclaimer])

  if (!data) return null

  const buildMeta = (): ReportExportMeta => ({
    organisationName: meta?.organisationName ?? 'Organisation',
    preparedBy: meta?.preparedBy ?? 'User',
    preparedAt: meta?.preparedAt ?? new Date().toLocaleString(),
    reportTitle: `${groupByLabel(data.groupBy)} report (${data.dataMode === 'historical' ? 'audit history' : 'snapshot'})`,
    dataMode: data.dataMode,
    disclaimer: data.disclaimer
  })

  const runExport = async (action: 'excel' | 'pdf' | 'html') => {
    setExporting(true)
    setAnchorEl(null)

    try {
      const charts = await resolveReportCharts(data)
      const exportMeta = buildMeta()

      if (action === 'excel') {
        exportReportExcel(data, exportMeta)
      } else if (action === 'pdf') {
        printReportPdf(data, exportMeta, charts)
      } else {
        exportReportHtml(data, exportMeta, charts)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <ButtonGroup variant='outlined' size='small'>
        <Button
          startIcon={exporting ? <CircularProgress size={14} color='inherit' /> : <i className='ri-download-2-line' />}
          onClick={e => setAnchorEl(e.currentTarget)}
          disabled={exporting}
        >
          {exporting ? 'Preparing…' : 'Export'}
        </Button>
      </ButtonGroup>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => void runExport('excel')} disabled={exporting}>
          <i className='ri-file-excel-2-line' style={{ marginRight: 8 }} />
          Excel (CSV data)
        </MenuItem>
        <MenuItem onClick={() => void runExport('pdf')} disabled={exporting}>
          <i className='ri-file-pdf-2-line' style={{ marginRight: 8 }} />
          PDF with charts
        </MenuItem>
        <MenuItem onClick={() => void runExport('html')} disabled={exporting}>
          <i className='ri-file-code-line' style={{ marginRight: 8 }} />
          HTML with charts
        </MenuItem>
      </Menu>
    </>
  )
}
