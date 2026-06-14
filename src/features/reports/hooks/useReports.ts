'use client'

import { useCallback, useEffect, useState } from 'react'

import type { ReportFilterOptions, ReportFilters, ReportPreset, ReportQueryResponse } from '../reports.types'
import { DEFAULT_REPORT_FILTERS } from '../reports.types'
import { fetchReportFilterOptions, fetchReportQuery } from '../services/reportsService'
import { buildDefaultMonthlyLoggedInFilters } from '../utils/monthlyReportHelpers'

export function useReports(initialFilters: Partial<ReportFilters> = {}) {
  const [filters, setFilters] = useState<ReportFilters>({ ...DEFAULT_REPORT_FILTERS, ...initialFilters })
  const [data, setData] = useState<ReportQueryResponse | null>(null)
  const [filterOptions, setFilterOptions] = useState<ReportFilterOptions | null>(null)
  const [loading, setLoading] = useState(false)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasInitialRun, setHasInitialRun] = useState(false)

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true)

    try {
      const options = await fetchReportFilterOptions()

      setFilterOptions(options)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load filter options')
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  const runReport = useCallback(async (nextFilters?: ReportFilters) => {
    const activeFilters = nextFilters ?? filters

    setLoading(true)
    setError(null)

    try {
      const result = await fetchReportQuery(activeFilters)

      setData(result)
      if (nextFilters) setFilters(activeFilters)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to run report')
    } finally {
      setLoading(false)
    }
  }, [filters])

  const applyFilters = useCallback(
    (nextFilters: ReportFilters) => {
      setFilters(nextFilters)
      void runReport(nextFilters)
    },
    [runReport]
  )

  const applyPreset = useCallback(
    (preset: ReportPreset) => {
      const next = { ...DEFAULT_REPORT_FILTERS, ...preset.filters }

      setFilters(next)
      void runReport(next)
    },
    [runReport]
  )

  const updateFilter = useCallback(<K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    const next = { ...DEFAULT_REPORT_FILTERS }

    setFilters(next)
    void runReport(next)
  }, [runReport])

  useEffect(() => {
    void loadOptions()
  }, [loadOptions])

  useEffect(() => {
    if (hasInitialRun || optionsLoading || !filterOptions) return

    const monthlyLoggedIn = buildDefaultMonthlyLoggedInFilters(filterOptions.stages)

    if (monthlyLoggedIn) {
      applyFilters(monthlyLoggedIn)
    } else {
      void runReport()
    }

    setHasInitialRun(true)
  }, [applyFilters, filterOptions, hasInitialRun, optionsLoading, runReport])

  return {
    filters,
    setFilters,
    updateFilter,
    data,
    filterOptions,
    loading,
    optionsLoading,
    error,
    runReport,
    applyPreset,
    applyFilters,
    clearFilters,
    refresh: () => runReport()
  }
}
