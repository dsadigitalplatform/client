export type SubscriptionPlan = {
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
  createdAt: string
  updatedAt: string
}
