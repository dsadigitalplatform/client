import type { LoanTypeDocumentMapping } from '@features/loan-types/loan-types.types'

export type GetLoanTypesParams = { q?: string }

export type CreateLoanTypeInput = {
  name: string
  description?: string | null
  isActive?: boolean
}

export async function getLoanTypes(params: GetLoanTypesParams = {}) {
  const url = new URL('/api/loan-types', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch loan types (${res.status})`)
  }

  const data = await res.json()

  return (data?.loanTypes ?? []) as any
}

export async function createLoanType(body: CreateLoanTypeInput) {
  const res = await fetch('/api/loan-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create loan type'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getLoanType(id: string) {
  const res = await fetch(`/api/loan-types/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch loan type')

  return res.json()
}

export async function updateLoanType(id: string, body: Partial<CreateLoanTypeInput>) {
  const res = await fetch(`/api/loan-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update loan type') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteLoanType(id: string) {
  const res = await fetch(`/api/loan-types/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete loan type')

  return res.json()
}

export async function getLoanTypeDocuments(id: string) {
  const res = await fetch(`/api/loan-types/${id}/documents`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch loan type documents')

  return res.json()
}

export async function updateLoanTypeDocuments(id: string, mappings: LoanTypeDocumentMapping[]) {
  const res = await fetch(`/api/loan-types/${id}/documents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mappings })
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update loan type documents') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}
