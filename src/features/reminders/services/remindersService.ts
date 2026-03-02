import type { ReminderListItem, ReminderStatus } from '@features/reminders/reminders.types'

export async function getReminders(params?: { status?: ReminderStatus; limit?: number }) {
  const qs = new URLSearchParams()

  if (params?.status) qs.set('status', params.status)
  if (params?.limit != null) qs.set('limit', String(params.limit))

  const res = await fetch(`/api/reminders?${qs.toString()}`, { cache: 'no-store' })
  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Failed to fetch reminders (${res.status})`) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return (data?.items ?? []) as ReminderListItem[]
}

export async function updateReminderStatus(id: string, status: ReminderStatus) {
  const res = await fetch(`/api/reminders/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  })

  const data = (await res.json().catch(() => ({}))) as any

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Failed to update reminder (${res.status})`) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return { ok: true } as const
}

