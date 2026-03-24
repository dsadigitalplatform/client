export type GetAssociateTypesParams = { q?: string }

export type CreateAssociateTypeInput = {
  name: string
  description?: string | null
  isActive?: boolean
}

export async function getAssociateTypes(params: GetAssociateTypesParams = {}) {
  const url = new URL('/api/associate-types', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch associate types (${res.status})`)
  }

  const data = await res.json()

  return (data?.associateTypes ?? []) as any
}

export async function createAssociateType(body: CreateAssociateTypeInput) {
  const res = await fetch('/api/associate-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create associate type'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getAssociateType(id: string) {
  const res = await fetch(`/api/associate-types/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch associate type')

  return res.json()
}

export async function updateAssociateType(id: string, body: Partial<CreateAssociateTypeInput>) {
  const res = await fetch(`/api/associate-types/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update associate type') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteAssociateType(id: string) {
  const res = await fetch(`/api/associate-types/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete associate type')

  return res.json()
}
