'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getDashboardLayout, saveDashboardLayout } from '@features/dashboard/services/dashboardService'
import type { DashboardGridItem, DashboardGridLayouts, DashboardWidgetId } from '@features/dashboard/dashboard.types'

const WIDGET_IDS: DashboardWidgetId[] = [
  'kpi-customers',
  'kpi-cases',
  'kpi-loan-volume',
  'kpi-conversion',
  'stage-breakdown',
  'trend-cases',
  'trend-loan-volume',
  'agents',
  'appointments'
]

function normalizeGridItem(input: any): DashboardGridItem | null {
  const i = typeof input?.i === 'string' ? (input.i as DashboardWidgetId) : null

  if (!i || !WIDGET_IDS.includes(i)) return null
  if (!Number.isFinite(input?.x) || !Number.isFinite(input?.y) || !Number.isFinite(input?.w) || !Number.isFinite(input?.h)) return null

  const item: DashboardGridItem = {
    i,
    x: Math.max(0, Math.floor(Number(input.x))),
    y: Math.max(0, Math.floor(Number(input.y))),
    w: Math.max(1, Math.floor(Number(input.w))),
    h: Math.max(1, Math.floor(Number(input.h)))
  }

  if (Number.isFinite(input?.minW)) item.minW = Math.max(1, Math.floor(Number(input.minW)))
  if (Number.isFinite(input?.minH)) item.minH = Math.max(1, Math.floor(Number(input.minH)))
  if (Number.isFinite(input?.maxW)) item.maxW = Math.max(1, Math.floor(Number(input.maxW)))
  if (Number.isFinite(input?.maxH)) item.maxH = Math.max(1, Math.floor(Number(input.maxH)))
  if (typeof input?.static === 'boolean') item.static = input.static

  return item
}

function normalizeLayouts(input: unknown): DashboardGridLayouts | null {
  if (!input || typeof input !== 'object') return null

  const obj = input as any

  const out: DashboardGridLayouts = {}

  ;(['lg', 'md', 'sm', 'xs'] as const).forEach(bp => {
    if (!Array.isArray(obj[bp])) return
    const seen = new Set<string>()
    const items: DashboardGridItem[] = []

    obj[bp].forEach((raw: any) => {
      const item = normalizeGridItem(raw)

      if (!item) return
      if (seen.has(item.i)) return
      seen.add(item.i)
      items.push(item)
    })

    out[bp] = items
  })

  const hasAny = Object.values(out).some(v => Array.isArray(v) && v.length > 0)

  return hasAny ? out : null
}

export const useDashboardLayout = (enabled: boolean) => {
  const [layout, setLayout] = useState<DashboardGridLayouts | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    try {
      const data = await getDashboardLayout()
      const normalized = normalizeLayouts(data)

      setLayout(normalized)
    } catch (e: any) {
      setError(e?.message || 'Failed to load layout')
      setLayout(null)
    } finally {
      setLoading(false)
    }
  }, [enabled])

  const save = useCallback(
    async (next: DashboardGridLayouts) => {
      if (!enabled) return

      setSaving(true)
      setError(null)

      try {
        const out = await saveDashboardLayout(next)
        const normalized = normalizeLayouts(out)

        setLayout(normalized)

        return normalized
      } catch (e: any) {
        setError(e?.message || 'Failed to save layout')

        return null
      } finally {
        setSaving(false)
      }
    },
    [enabled]
  )

  useEffect(() => {
    refresh()
  }, [refresh])

  return useMemo(
    () => ({
      layout,
      loading,
      saving,
      error,
      refresh,
      save
    }),
    [layout, loading, saving, error, refresh, save]
  )
}
