export type GetAdvocatesParams = { q?: string }

export type CreateAdvocateInput = {
  name: string
  countryCode: string
  mobile: string
  email?: string | null
  address?: string | null
}

export async function getAdvocates(params: GetAdvocatesParams = {}) {
  const url = new URL('/api/advocates', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch advocates (${res.status})`)
  }

  const data = await res.json()

  return (data?.advocates ?? []) as any
}

export async function createAdvocate(body: CreateAdvocateInput) {
  const res = await fetch('/api/advocates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create advocate'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getAdvocate(id: string) {
  const res = await fetch(`/api/advocates/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch advocate')

  return res.json()
}

export async function updateAdvocate(id: string, body: Partial<CreateAdvocateInput>) {
  const res = await fetch(`/api/advocates/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update advocate') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteAdvocate(id: string) {
  const res = await fetch(`/api/advocates/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete advocate')

  return res.json()
}
