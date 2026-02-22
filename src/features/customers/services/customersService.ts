export type GetCustomersParams = { q?: string }

export type CreateCustomerInput = {
  fullName: string
  mobile: string
  email?: string | null
  dob?: string | null
  pan?: string | null
  aadhaarMasked?: string | null
  address?: string | null
  employmentType: 'SALARIED' | 'SELF_EMPLOYED'
  monthlyIncome?: number | null
  cibilScore?: number | null
  source: 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'
}

export async function getCustomers(params: GetCustomersParams = {}) {
  const url = new URL('/api/customers', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(errText || `Failed to fetch customers (${res.status})`)
  }
  const data = await res.json()
  return (data?.customers ?? []) as any
}

export async function createCustomer(body: CreateCustomerInput) {
  const res = await fetch('/api/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create customer'
    const details = data?.details
    const err = new Error(message) as any
    if (details) err.details = details
    throw err
  }
  return data
}
