export type GetLoanStatusPipelineStagesParams = { q?: string }

export type CreateLoanStatusPipelineStageInput = {
  name: string
  description?: string | null
  order: number
}

export async function getLoanStatusPipelineStages(params: GetLoanStatusPipelineStagesParams = {}) {
  const url = new URL(
    '/api/loan-status-pipeline',
    typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  )

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch loan status pipeline (${res.status})`)
  }

  const data = await res.json()

  return (data?.stages ?? []) as any
}

export async function createLoanStatusPipelineStage(body: CreateLoanStatusPipelineStageInput) {
  const res = await fetch('/api/loan-status-pipeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create stage'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getLoanStatusPipelineStage(id: string) {
  const res = await fetch(`/api/loan-status-pipeline/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch stage')

  return res.json()
}

export async function updateLoanStatusPipelineStage(id: string, body: Partial<CreateLoanStatusPipelineStageInput>) {
  const res = await fetch(`/api/loan-status-pipeline/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update stage') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteLoanStatusPipelineStage(id: string) {
  const res = await fetch(`/api/loan-status-pipeline/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete stage')

  return res.json()
}

