export type GetAssociatesParams = { q?: string }

export type CreateAssociateInput = {
  associateName: string
  companyName: string
  associateTypeId: string
  countryCode: string
  mobile: string
  email?: string | null
  payout?: number | null
  pan?: string | null
  isActive: boolean
}

export async function getAssociates(params: GetAssociatesParams = {}) {
  const url = new URL('/api/associates', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch associates (${res.status})`)
  }

  const data = await res.json()

  return (data?.associates ?? []) as any
}

export async function createAssociate(body: CreateAssociateInput) {
  const res = await fetch('/api/associates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create associate'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getAssociate(id: string) {
  const res = await fetch(`/api/associates/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch associate')

  return res.json()
}

export async function updateAssociate(id: string, body: Partial<CreateAssociateInput>) {
  const res = await fetch(`/api/associates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update associate') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteAssociate(id: string) {
  const res = await fetch(`/api/associates/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete associate')

  return res.json()
}
