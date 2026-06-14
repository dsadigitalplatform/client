import type { DashboardGridLayouts, DashboardOverview, MonthlyPerformanceData } from '@features/dashboard/dashboard.types'

export async function getDashboardOverview() {
  const res = await fetch('/api/dashboard/overview', { cache: 'no-store' })

  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Failed to fetch dashboard overview (${res.status})`) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data as DashboardOverview
}

export async function getMonthlyPerformance(assignedAgentId?: string) {
  const params = new URLSearchParams()

  if (assignedAgentId) params.set('assignedAgentId', assignedAgentId)

  const qs = params.toString()
  const res = await fetch(`/api/dashboard/monthly-performance${qs ? `?${qs}` : ''}`, { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Failed to fetch monthly performance (${res.status})`) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data as MonthlyPerformanceData
}

export async function getDashboardLayout() {
  const res = await fetch('/api/dashboard/layout', { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Failed to fetch dashboard layout (${res.status})`) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return (data?.layout ?? null) as DashboardGridLayouts | null
}

export async function saveDashboardLayout(layout: DashboardGridLayouts) {
  const res = await fetch('/api/dashboard/layout', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ layout })
  })

  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Failed to save dashboard layout (${res.status})`) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return (data?.layout ?? null) as DashboardGridLayouts | null
}
