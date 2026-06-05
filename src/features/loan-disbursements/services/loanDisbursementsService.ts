import type {
  AddLoanDisbursementInput,
  CreateDisbursementTrackerInput,
  DisbursementAuditHistoryItem,
  DisbursementTrackerDetails,
  DisbursementTrackerListItem,
  EligibleLeadItem
} from '@features/loan-disbursements/loan-disbursements.types'

export type DisbursementListSummary = {
  total: number
  pending: number
  partial: number
  completed: number
  totalDisbursed: number
}

export async function listDisbursementTrackers(filters?: { assignedAgentId?: string }) {
  const params = new URLSearchParams()

  if (filters?.assignedAgentId) params.set('assignedAgentId', filters.assignedAgentId)

  const query = params.toString()
  const res = await fetch(`/api/loan-disbursements${query ? `?${query}` : ''}`, { cache: 'no-store' })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error((data as { message?: string }).message || (data as { error?: string }).error || 'Failed to load trackers') as Error & {
      code?: string
    }

    throw err
  }

  const data = await res.json()

  return {
    trackers: (data?.trackers ?? []) as DisbursementTrackerListItem[],
    summary: (data?.summary ?? { total: 0, pending: 0, partial: 0, completed: 0, totalDisbursed: 0 }) as DisbursementListSummary
  }
}

export async function getEligibleLeadsForDisbursement() {
  const res = await fetch('/api/loan-disbursements/eligible-leads', { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to load eligible leads')

  const data = await res.json()

  return (data?.leads ?? []) as EligibleLeadItem[]
}

export async function createDisbursementTracker(body: CreateDisbursementTrackerInput) {
  const res = await fetch('/api/loan-disbursements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = (data as { message?: string }).message || (data as { error?: string }).error || 'Failed to create tracker'
    const err = new Error(message) as Error & { code?: string; trackerId?: string; details?: Record<string, string> }

    err.code = (data as { error?: string }).error
    if ((data as { trackerId?: string }).trackerId) err.trackerId = (data as { trackerId?: string }).trackerId
    if ((data as { details?: Record<string, string> }).details) err.details = (data as { details?: Record<string, string> }).details
    throw err
  }

  return data as { id: string }
}

export async function getDisbursementTrackerById(id: string) {
  const res = await fetch(`/api/loan-disbursements/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to load disbursement tracker')

  return (await res.json()) as DisbursementTrackerDetails
}

export async function addLoanDisbursement(trackerId: string, body: AddLoanDisbursementInput) {
  const res = await fetch(`/api/loan-disbursements/${trackerId}/disbursements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = (data as { message?: string }).message || (data as { error?: string }).error || 'Failed to record disbursement'
    const err = new Error(message) as Error & { details?: Record<string, string> }

    if ((data as { details?: Record<string, string> }).details) err.details = (data as { details?: Record<string, string> }).details
    throw err
  }

  return data as {
    disbursementId: string
    totalDisbursedAmount: number
    remainingAmount: number
    disbursementStatus: string
  }
}

export async function getDisbursementAuditHistory(trackerId: string) {
  const res = await fetch(`/api/loan-disbursements/${trackerId}/audit-history`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to load audit history')

  const data = await res.json()

  return (data?.items ?? []) as DisbursementAuditHistoryItem[]
}
