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
 *
 * Expand by adding entries here — UI, APIs, and enforcement stay in sync.
 */

export const TRIAL_DAYS = 14

export const UNLIMITED = -1

export type FeatureStatus = 'available' | 'coming_soon'

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
    description: 'Active and invited members allowed in this organisation.',
    status: 'available',
    unit: 'users',
    defaultValue: 3,
    min: 1
  },
  {
    key: 'maxCustomers',
    kind: 'limit',
    label: 'Customers',
    description: 'Maximum customer records that can be stored.',
    status: 'available',
    unit: 'customers',
    defaultValue: 50,
    min: 0
  },
  {
    key: 'maxLeads',
    kind: 'limit',
    label: 'Leads',
    description: 'Maximum loan leads/cases that can be created.',
    status: 'available',
    unit: 'leads',
    defaultValue: 100,
    min: 0
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

export function getFeatureDef(key: FeatureKey): FeatureDef | undefined {
  return FEATURE_CATALOG.find(f => f.key === key)
}
