import type { PlanEntitlements } from '@features/subscription-plans/featureCatalog'
import type { TenantSubscriptionSummary } from '@features/subscription-plans/subscription-plans.types'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'
  | 'incomplete'

export type BillingInterval = 'monthly' | 'yearly'
export type RenewalMode = 'auto' | 'manual'

export type ManualPaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'other' | 'complimentary'

export type DiscountType = 'percent' | 'fixed'
export type DiscountScope = 'global' | 'plan' | 'tenant'
export type DiscountDuration = 'once' | 'repeating' | 'forever'

export type TenantSubscription = {
  _id: string
  tenantId: string
  planId: string
  status: SubscriptionStatus
  billingInterval: BillingInterval
  renewalMode: RenewalMode
  trialStartsAt: string | null
  trialEndsAt: string | null
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  /** Scheduled plan id for end-of-period downgrade / lateral moves */
  pendingPlanId: string | null
  pendingBillingInterval: BillingInterval | null
  pendingChangeEffectiveAt: string | null
  pendingChangeKind: 'upgrade' | 'downgrade' | 'lateral' | null
  /**
   * Frozen entitlements for catalog-reduction grandfathering until period end.
   * Resolved as max(snapshot, live plan) so expansions still apply immediately.
   */
  entitlementsSnapshot: PlanEntitlements | null
  /** Plan entitlementsVersion when snapshot was last written */
  entitlementsVersion: number | null
  billingContactUserId: string
  billingContactNominatedBy: string | null
  discountCodeId: string | null
  discountSnapshot: DiscountSnapshot | null
  /** Payment provider: stripe | razorpay | manual | null */
  paymentProvider: string | null
  externalCustomerId: string | null
  externalSubscriptionId: string | null
  externalPlanId: string | null
  externalSubscriptionStatus: string | null
  defaultPaymentMethodLabel: string | null
  lastPaymentStatus: 'none' | 'pending' | 'succeeded' | 'failed'
  /** Offline / promo payment method recorded by Super Admin */
  lastPaymentMethod: ManualPaymentMethod | null
  lastPaymentNote: string | null
  lastPaymentAt: string | null
  lastPaymentRecordedBy: string | null
  reminderDaysBeforeDue: number[]
  createdAt: string
  updatedAt: string
}

export type DiscountSnapshot = {
  code: string
  type: DiscountType
  value: number
  currency: string | null
  duration: DiscountDuration
  durationMonths: number | null
}

export type DiscountCode = {
  _id: string
  code: string
  name: string
  description: string
  type: DiscountType
  value: number
  currency: string | null
  scope: DiscountScope
  planIds: string[]
  tenantIds: string[]
  validFrom: string
  validTo: string
  maxRedemptions: number | null
  redemptionCount: number
  duration: DiscountDuration
  durationMonths: number | null
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type UsageSnapshot = {
  users: number
  customers: number
  leads: number
}

export type ResolvedEntitlements = {
  planId: string | null
  planName: string | null
  subscription: TenantSubscription | null
  entitlements: PlanEntitlements
  usage: UsageSnapshot
  access: {
    isUsable: boolean
    reason: string | null
    inTrial: boolean
    trialEndsAt: string | null
    daysLeftInTrial: number | null
  }
}

export type TenantSubscriptionView = {
  subscription: TenantSubscription | null
  plan: (TenantSubscriptionSummary & { entitlements: PlanEntitlements }) | null
  entitlements: PlanEntitlements
  usage: UsageSnapshot
  access: ResolvedEntitlements['access']
  billingContact: { userId: string; name: string | null; email: string | null; role: string | null } | null
  canManageBilling: boolean
  canNominateBillingContact: boolean
  /** Owner (or super admin) may change / cancel plan */
  canChangePlan: boolean
  pendingPlan: (TenantSubscriptionSummary & { entitlements: PlanEntitlements }) | null
  availablePlans: Array<
    TenantSubscriptionSummary & {
      entitlements: PlanEntitlements
      changeKind: 'upgrade' | 'downgrade' | 'lateral' | 'same' | null
    }
  >
  changePolicy: {
    automaticRefunds: boolean
    annualMidTermRefunds: boolean
    copy: {
      upgrade: string
      downgrade: string
      cancel: string
      cancelAnnual: string
      trialSwitch: string
      usageBlocked: string
      paymentsPending: string
    }
  }
}
