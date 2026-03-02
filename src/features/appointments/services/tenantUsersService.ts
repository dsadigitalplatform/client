export type TenantUserOption = {
  id: string
  name: string
  email: string | null
}

export async function getTenantUsers() {
  const res = await fetch('/api/tenant-users', { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch tenant users')

  const data = await res.json().catch(() => ({}))

  return (data?.users ?? []) as TenantUserOption[]
}

