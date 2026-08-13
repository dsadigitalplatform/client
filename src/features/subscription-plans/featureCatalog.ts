/**
 * Canonical DSA subscription entitlements.
 *
 * Industry model (Stripe-like):
 * - Catalog (subscriptionPlans) defines price + entitlements
 * - Subscription (tenantSubscriptions) is the tenant's live billing state
 * - Entitlements resolve from the subscription's plan, with hybrid catalog-edit
 *   propagation (expansions immediate; reductions held via entitlementsSnapshot
 *   until period end — see planCatalogEditPolicy)
 * - Limits are numeric quotas (-1 = unlimited); modules are on/off (+ coming_soon)
 * - Seats are a standing total; customers and leads reset each calendar month
 *
 * Expand by adding entries here — UI, APIs, and enforcement stay in sync.
 */

export const TRIAL_DAYS = 14

export const UNLIMITED = -1

export type FeatureStatus = 'available' | 'coming_soon'

/** Standing limits never reset; monthly limits reset at the start of each calendar month. */
export type LimitResetPolicy = 'never' | 'monthly'

export type LimitFeatureKey = 'maxUsers' | 'maxCustomers' | 'maxLeads'
export type ModuleFeatureKey = 'reports' | 'progressiveDisbursement' | 'associateCommission'

export type FeatureKey = LimitFeatureKey | ModuleFeatureKey

export type LimitFeatureDef = {
  key: LimitFeatureKey
  kind: 'limit'
  label: string
  description: string
  status: FeatureStatus
  unit: string
  defaultValue: number
  min: number
  reset: LimitResetPolicy
}

export type ModuleFeatureDef = {
  key: ModuleFeatureKey
  kind: 'module'
  label: string
  description: string
  status: FeatureStatus
  defaultEnabled: boolean
}

export type FeatureDef = LimitFeatureDef | ModuleFeatureDef

export const LIMIT_FEATURES: LimitFeatureDef[] = [
  {
    key: 'maxUsers',
    kind: 'limit',
    label: 'Team seats',
    description: 'Active and invited members allowed in this organisation. Standing total — does not reset.',
    status: 'available',
    unit: 'users',
    defaultValue: 3,
    min: 1,
    reset: 'never'
  },
  {
    key: 'maxCustomers',
    kind: 'limit',
    label: 'Customers',
    description: 'New customer records that can be created each calendar month. Count resets on the 1st.',
    status: 'available',
    unit: 'customers',
    defaultValue: 50,
    min: 0,
    reset: 'monthly'
  },
  {
    key: 'maxLeads',
    kind: 'limit',
    label: 'Leads',
    description: 'New loan leads/cases that can be created each calendar month. Count resets on the 1st.',
    status: 'available',
    unit: 'leads',
    defaultValue: 100,
    min: 0,
    reset: 'monthly'
  }
]

export const MODULE_FEATURES: ModuleFeatureDef[] = [
  {
    key: 'reports',
    kind: 'module',
    label: 'Reports',
    description: 'Access to the reports builder and analytics exports.',
    status: 'available',
    defaultEnabled: false
  },
  {
    key: 'progressiveDisbursement',
    kind: 'module',
    label: 'Progressive disbursement',
    description: 'Track multi-tranche loan disbursements on leads.',
    status: 'available',
    defaultEnabled: false
  },
  {
    key: 'associateCommission',
    kind: 'module',
    label: 'Associate commission',
    description: 'Commission tracking and payouts for associates.',
    status: 'coming_soon',
    defaultEnabled: false
  }
]

export const FEATURE_CATALOG: FeatureDef[] = [...LIMIT_FEATURES, ...MODULE_FEATURES]

export type PlanLimits = Record<LimitFeatureKey, number>
export type PlanModules = Record<ModuleFeatureKey, boolean>

export type PlanEntitlements = {
  limits: PlanLimits
  modules: PlanModules
}

export function defaultPlanEntitlements(): PlanEntitlements {
  return {
    limits: Object.fromEntries(LIMIT_FEATURES.map(f => [f.key, f.defaultValue])) as PlanLimits,
    modules: Object.fromEntries(MODULE_FEATURES.map(f => [f.key, f.defaultEnabled])) as PlanModules
  }
}

export function normalizePlanEntitlements(raw: unknown, fallbackMaxUsers?: number): PlanEntitlements {
  const base = defaultPlanEntitlements()
  const src = raw && typeof raw === 'object' ? (raw as any) : {}
  const limitsSrc = src.limits && typeof src.limits === 'object' ? src.limits : src
  const modulesSrc = src.modules && typeof src.modules === 'object' ? src.modules : src

  for (const f of LIMIT_FEATURES) {
    const v = limitsSrc[f.key]

    if (typeof v === 'number' && Number.isFinite(v) && (v === UNLIMITED || v >= f.min)) {
      base.limits[f.key] = Math.trunc(v)
    } else if (f.key === 'maxUsers' && typeof fallbackMaxUsers === 'number' && fallbackMaxUsers >= 1) {
      base.limits.maxUsers = Math.trunc(fallbackMaxUsers)
    }
  }

  for (const f of MODULE_FEATURES) {
    if (typeof modulesSrc[f.key] === 'boolean') {
      base.modules[f.key] = modulesSrc[f.key]
    } else if (typeof src.features?.[f.key] === 'boolean') {
      // Legacy free-form features map
      base.modules[f.key] = Boolean(src.features[f.key])
    }
  }

  return base
}

export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED
}

export function isMonthlyLimit(key: LimitFeatureKey | string): boolean {
  return LIMIT_FEATURES.find(f => f.key === key)?.reset === 'monthly'
}

export function limitResetCaption(key: LimitFeatureKey | string): string {
  return isMonthlyLimit(key) ? '/ month' : 'total'
}

export function getFeatureDef(key: FeatureKey): FeatureDef | undefined {
  return FEATURE_CATALOG.find(f => f.key === key)
}
