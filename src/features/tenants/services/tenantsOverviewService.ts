export type TenantItem = {
  _id: string
  name: string
  type: 'sole_trader' | 'company'
  status: 'active' | 'suspended'
  role: 'OWNER' | 'ADMIN' | 'USER'
  subscriptionPlanId?: string | null
}

export async function listTenantsByUser(): Promise<{ tenants: TenantItem[] }> {
  const res = await fetch('/api/tenants/by-user', { cache: 'no-store' })
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || 'request_failed')
  }

  
return data as { tenants: TenantItem[] }
}

export async function updateTenant(id: string, input: { name?: string; type?: 'sole_trader' | 'company' }) {
  const res = await fetch(`/api/tenants/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || 'request_failed')
  }

  
return data as { tenant: TenantItem }
}
