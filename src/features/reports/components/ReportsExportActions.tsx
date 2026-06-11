'use client'

import { useEffect, useState } from 'react'

import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import CircularProgress from '@mui/material/CircularProgress'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'

import type { ReportDetailGroupDimension, ReportExportMeta, ReportQueryResponse } from '../reports.types'
import {
  exportReportExcel,
  exportReportExcelFlat,
  exportReportExcelFlatOnly,
  exportReportHtml,
  groupByLabel,
  printReportPdf
} from '../utils/exportReport'
import { resolveReportCharts } from '../utils/resolveReportCharts'
import { fetchProfileName, fetchSessionTenant } from '../services/reportsService'

type Props = {
  data: ReportQueryResponse | null
  groupBySecondary: ReportDetailGroupDimension | null
}

export default function ReportsExportActions({ data, groupBySecondary }: Props) {
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
    reportTitle: `${groupByLabel(data.groupBy)}${groupBySecondary ? ` → ${groupByLabel(groupBySecondary)}` : ''} report (${data.dataMode === 'historical' ? 'audit history' : 'snapshot'})`,
    dataMode: data.dataMode,
    disclaimer: data.disclaimer,
    groupBySecondary
  })

  const runExport = async (action: 'excel-grouped' | 'excel-flat' | 'excel-flat-only' | 'pdf' | 'html') => {
    setExporting(true)
    setAnchorEl(null)

    try {
      const exportMeta = buildMeta()

      if (action === 'excel-flat-only') {
        exportReportExcelFlatOnly(data)
        return
      }

      const charts = await resolveReportCharts(data)

      if (action === 'excel-grouped') {
        exportReportExcel(data, { ...exportMeta, detailFormat: 'grouped' })
      } else if (action === 'excel-flat') {
        exportReportExcelFlat(data, exportMeta)
      } else if (action === 'pdf') {
        printReportPdf(data, { ...exportMeta, detailFormat: 'grouped' }, charts)
      } else {
        exportReportHtml(data, { ...exportMeta, detailFormat: 'grouped' }, charts)
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
        <MenuItem onClick={() => void runExport('excel-grouped')} disabled={exporting}>
          <i className='ri-file-excel-2-line' style={{ marginRight: 8 }} />
          Excel — grouped (with subtotals)
        </MenuItem>
        <MenuItem onClick={() => void runExport('excel-flat')} disabled={exporting}>
          <i className='ri-file-list-2-line' style={{ marginRight: 8 }} />
          Excel — flat list (full report)
        </MenuItem>
        <MenuItem onClick={() => void runExport('excel-flat-only')} disabled={exporting}>
          <i className='ri-table-line' style={{ marginRight: 8 }} />
          CSV — simple list (rows only)
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
