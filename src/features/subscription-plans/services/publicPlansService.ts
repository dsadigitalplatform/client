type PublicPlan = {
  _id: string
  name: string
  slug: string
  description: string
  priceMonthly: number
  priceYearly?: number | null
  currency: string
  maxUsers: number
  features: Record<string, boolean>
  isActive: boolean
  isDefault: boolean
}

export async function listPublicPlans(): Promise<{ plans: PublicPlan[] }> {
  const res = await fetch('/api/subscription-plans', { cache: 'no-store' })
  const data = await res.json()

  if (!res.ok) {
    throw new Error(data?.error || 'request_failed')
  }

  
return data as { plans: PublicPlan[] }
}
