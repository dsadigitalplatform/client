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

export const MODULE_CATEGORIES = [
  { key: 'operations', label: 'Operations', description: 'Day-to-day DSA workflow' },
  { key: 'access', label: 'Access & team', description: 'Roles, permissions, and team performance' },
  { key: 'insights', label: 'Insights', description: 'Dashboards and reporting' },
  { key: 'growth', label: 'Growth & extras', description: 'Branding, referrals, and add-on modules' }
] as const

export type ModuleCategory = (typeof MODULE_CATEGORIES)[number]['key']

export type LimitFeatureKey = 'maxUsers' | 'maxCustomers' | 'maxLeads'
export type ModuleFeatureKey =
  | 'masterDataManagement'
  | 'leadCaptureAssignment'
  | 'loanApplicationTracking'
  | 'roleBasedAccess'
  | 'multiLoanProducts'
  | 'multiLenderTracking'
  | 'teamPerformance'
  | 'reports'
  | 'dynamicDashboards'
  | 'ownBranding'
  | 'referAndReward'
  | 'progressiveDisbursement'
  | 'associateCommission'

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
  category: ModuleCategory
  icon: string
  accent: 'primary' | 'info' | 'success' | 'warning' | 'secondary'
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
    key: 'masterDataManagement',
    kind: 'module',
    label: 'Master data management',
    description: 'Maintain banks, loan types, associates, corporates, and other reference data in one place.',
    status: 'available',
    defaultEnabled: false,
    category: 'operations',
    icon: 'ri-database-2-line',
    accent: 'primary'
  },
  {
    key: 'leadCaptureAssignment',
    kind: 'module',
    label: 'Lead capture & assignment',
    description: 'Capture incoming leads and assign them to the right sales agents.',
    status: 'available',
    defaultEnabled: false,
    category: 'operations',
    icon: 'ri-user-add-line',
    accent: 'info'
  },
  {
    key: 'loanApplicationTracking',
    kind: 'module',
    label: 'Loan application tracking',
    description: 'Follow each application through the pipeline from login to sanction and disbursement.',
    status: 'available',
    defaultEnabled: false,
    category: 'operations',
    icon: 'ri-file-list-3-line',
    accent: 'success'
  },
  {
    key: 'multiLoanProducts',
    kind: 'module',
    label: 'Multi loan products',
    description: 'Offer and manage multiple loan products from a single organisation workspace.',
    status: 'available',
    defaultEnabled: false,
    category: 'operations',
    icon: 'ri-apps-2-line',
    accent: 'secondary'
  },
  {
    key: 'multiLenderTracking',
    kind: 'module',
    label: 'Multi lender tracking',
    description: 'Track cases across multiple lenders and banks without switching workspaces.',
    status: 'available',
    defaultEnabled: false,
    category: 'operations',
    icon: 'ri-bank-line',
    accent: 'info'
  },
  {
    key: 'progressiveDisbursement',
    kind: 'module',
    label: 'Progressive disbursement',
    description: 'Track multi-tranche loan disbursements on leads.',
    status: 'available',
    defaultEnabled: false,
    category: 'operations',
    icon: 'ri-funds-line',
    accent: 'success'
  },
  {
    key: 'roleBasedAccess',
    kind: 'module',
    label: 'Role-based access control',
    description: 'Roles and permissions so each team member sees only what they need.',
    status: 'available',
    defaultEnabled: false,
    category: 'access',
    icon: 'ri-shield-user-line',
    accent: 'primary'
  },
  {
    key: 'teamPerformance',
    kind: 'module',
    label: 'Team performance',
    description: 'Monitor sales-agent activity, conversion, and team productivity.',
    status: 'available',
    defaultEnabled: false,
    category: 'access',
    icon: 'ri-trophy-line',
    accent: 'warning'
  },
  {
    key: 'reports',
    kind: 'module',
    label: 'Lender, loan & agent reports',
    description: 'Lender-wise, loan-wise, and sales-agent-wise reports, plus analytics exports.',
    status: 'available',
    defaultEnabled: false,
    category: 'insights',
    icon: 'ri-file-chart-line',
    accent: 'info'
  },
  {
    key: 'dynamicDashboards',
    kind: 'module',
    label: 'Dynamic dashboards',
    description: 'Live operational dashboards that can be tailored to how the organisation works.',
    status: 'available',
    defaultEnabled: false,
    category: 'insights',
    icon: 'ri-dashboard-3-line',
    accent: 'primary'
  },
  {
    key: 'ownBranding',
    kind: 'module',
    label: 'Own branding',
    description: 'White-label the workspace with the organisation’s logo, colours, and identity.',
    status: 'available',
    defaultEnabled: false,
    category: 'growth',
    icon: 'ri-palette-line',
    accent: 'secondary'
  },
  {
    key: 'referAndReward',
    kind: 'module',
    label: 'Refer & reward program',
    description: 'Referral invites, credits, and rewards to grow the organisation’s network.',
    status: 'available',
    defaultEnabled: false,
    category: 'growth',
    icon: 'ri-gift-line',
    accent: 'warning'
  },
  {
    key: 'associateCommission',
    kind: 'module',
    label: 'Associate commission',
    description: 'Commission tracking and payouts for associates.',
    status: 'coming_soon',
    defaultEnabled: false,
    category: 'growth',
    icon: 'ri-hand-coin-line',
    accent: 'success'
  }
]

export const FEATURE_CATALOG: FeatureDef[] = [...LIMIT_FEATURES, ...MODULE_FEATURES]

export type PlanLimits = Record<LimitFeatureKey, number>
export type PlanModules = Record<ModuleFeatureKey, boolean>

export type PlanEntitlements = {
  limits: PlanLimits
  modules: PlanModules
}

export type ModuleCategoryGroup = {
  key: ModuleCategory
  label: string
  description: string
  features: ModuleFeatureDef[]
}

export function modulesByCategory(): ModuleCategoryGroup[] {
  return MODULE_CATEGORIES.map(cat => ({
    ...cat,
    features: MODULE_FEATURES.filter(f => f.category === cat.key)
  })).filter(group => group.features.length > 0)
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
