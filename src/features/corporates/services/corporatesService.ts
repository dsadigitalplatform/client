export type GetCorporatesParams = { q?: string }

export type CreateCorporateInput = {
  code: string
  name: string
  isActive?: boolean
}

export async function getCorporates(params: GetCorporatesParams = {}) {
  const url = new URL('/api/corporates', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch corporates (${res.status})`)
  }

  const data = await res.json()

  return (data?.corporates ?? []) as any
}

export async function createCorporate(body: CreateCorporateInput) {
  const res = await fetch('/api/corporates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create corporate'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getCorporate(id: string) {
  const res = await fetch(`/api/corporates/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch corporate')

  return res.json()
}

export async function updateCorporate(id: string, body: Partial<CreateCorporateInput>) {
  const res = await fetch(`/api/corporates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update corporate') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteCorporate(id: string) {
  const res = await fetch(`/api/corporates/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete corporate')

  return res.json()
}
