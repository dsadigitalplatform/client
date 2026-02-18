export type CreatePlanInput = {
  name: string
  slug: string
  description: string
  priceMonthly: number
  priceYearly?: number | null
  currency?: string
  maxUsers: number
  features?: Record<string, boolean>
  isActive?: boolean
  isDefault?: boolean
}

export type UpdatePlanInput = Partial<CreatePlanInput> & { id: string }

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {})
    }
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))

    throw new Error(err?.error || 'request_failed')
  }

  
return res.json()
}

export const subscriptionPlansService = {
  list: () => api<{ plans: any[] }>('/api/super-admin/subscription-plans'),
  create: (input: CreatePlanInput) =>
    api<{ plan: any }>('/api/super-admin/subscription-plans', { method: 'POST', body: JSON.stringify(input) }),
  update: (input: UpdatePlanInput) =>
    api<{ plan: any }>(`/api/super-admin/subscription-plans/${encodeURIComponent(input.id)}`, {
      method: 'PUT',
      body: JSON.stringify(input)
    }),
  remove: (id: string) =>
    api<{ success: boolean }>(`/api/super-admin/subscription-plans/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
