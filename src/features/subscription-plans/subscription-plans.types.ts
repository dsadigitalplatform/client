import type { PlanEntitlements } from './featureCatalog'

export type SubscriptionPlan = {
  _id: string
  name: string
  slug: string
  description: string
  priceMonthly: number
  priceYearly?: number | null
  currency: string
  maxUsers: number
  /** @deprecated prefer entitlements.modules — kept for backward compatibility */
  features: Record<string, boolean>
  entitlements?: PlanEntitlements
  trialDays?: number
  /** When false, new organisations on this plan skip the free trial. */
  trialEnabled?: boolean
  /** Bumped when Super Admin changes entitlements or price on the catalog plan. */
  entitlementsVersion?: number
  /** Canonical prices in paise (preferred over float rupees for billing). */
  priceMonthlyPaise?: number | null
  priceYearlyPaise?: number | null
  razorpayPlanIdMonthly?: string | null
  razorpayPlanIdYearly?: string | null
  isActive: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

/** Lean plan payload attached to tenant responses (no features / admin flags). */
export type TenantSubscriptionSummary = {
  _id: string
  name: string
  slug: string
  description: string
  priceMonthly: number
  priceYearly?: number | null
  currency: string
  maxUsers: number
}
