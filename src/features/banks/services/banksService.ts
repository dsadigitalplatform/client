export type GetBanksParams = { q?: string }

export type CreateBankInput = {
  code: string
  name: string
  description?: string | null
}

export async function getBanks(params: GetBanksParams = {}) {
  const url = new URL('/api/banks', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch banks (${res.status})`)
  }

  const data = await res.json()

  return (data?.banks ?? []) as any
}

export async function createBank(body: CreateBankInput) {
  const res = await fetch('/api/banks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create bank'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getBank(id: string) {
  const res = await fetch(`/api/banks/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch bank')

  return res.json()
}

export async function updateBank(id: string, body: Partial<CreateBankInput>) {
  const res = await fetch(`/api/banks/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update bank') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteBank(id: string) {
  const res = await fetch(`/api/banks/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete bank')

  return res.json()
}

export type MigrateBanksFromLeadsResult = {
  scanned: number
  imported: number
  skipped: number
  names: string[]
}

export async function migrateBanksFromLeads() {
  const res = await fetch('/api/banks/migrate-from-leads', { method: 'POST' })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.message || data?.error || 'Failed to import banks from leads')
  }

  return data as MigrateBanksFromLeadsResult
}
