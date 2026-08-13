/**
 * Locked policy: how Super Admin catalog edits affect existing subscribers.
 *
 * - Entitlement expansions (higher limits / new modules): immediate for all on that plan
 * - Entitlement reductions: deferred to each tenant's currentPeriodEnd (keep prior rights via snapshot)
 * - Price changes: next billing period only (display/invoice; no mid-cycle rewrite)
 */

import type { PlanEntitlements } from '@features/subscription-plans/featureCatalog'
import { isUnlimited, LIMIT_FEATURES, MODULE_FEATURES } from '@features/subscription-plans/featureCatalog'

import { entitlementsExpand, entitlementsShrink } from '@features/subscriptions/subscriptionChangePolicy'

export const PLAN_CATALOG_EDIT_POLICY = {
  expansionsApply: 'immediate' as const,
  reductionsApply: 'period_end' as const,
  priceChangesApply: 'next_period' as const
}

export const PLAN_CATALOG_EDIT_COPY = {
  expansions:
    'Increased limits and newly enabled modules apply immediately to all organisations on this plan.',
  reductions:
    'Reduced limits and disabled modules apply at each organisation’s period end. Until then they keep their current entitlements.',
  price: 'Price changes apply from the next billing period only (not mid-cycle).',
  noSubscribers: 'No active organisations are on this plan. Changes apply to future subscribers only.'
}

export type CatalogEditImpact = {
  expands: boolean
  shrinks: boolean
  priceChanged: boolean
  activeSubscriberCount: number
}

function limitRank(limit: number): number {
  return isUnlimited(limit) ? Number.POSITIVE_INFINITY : limit
}

/**
 * During the current period, take the more generous of snapshot vs live catalog
 * so expansions land immediately while reductions stay deferred.
 */
export function mergeEntitlementsPreferHigher(snapshot: PlanEntitlements, live: PlanEntitlements): PlanEntitlements {
  const limits = { ...live.limits }
  const modules = { ...live.modules }

  for (const f of LIMIT_FEATURES) {
    const a = snapshot.limits[f.key]
    const b = live.limits[f.key]

    limits[f.key] = limitRank(a) >= limitRank(b) ? a : b
  }

  for (const f of MODULE_FEATURES) {
    modules[f.key] = Boolean(snapshot.modules[f.key] || live.modules[f.key])
  }

  return { limits, modules }
}

export function classifyCatalogEntitlementChange(from: PlanEntitlements, to: PlanEntitlements) {
  return {
    expands: entitlementsExpand(from, to),
    shrinks: entitlementsShrink(from, to)
  }
}

export function buildCatalogEditMessages(impact: CatalogEditImpact): string[] {
  const messages: string[] = []

  if (impact.activeSubscriberCount <= 0) {
    messages.push(PLAN_CATALOG_EDIT_COPY.noSubscribers)

    return messages
  }

  messages.push(
    `${impact.activeSubscriberCount} organisation${impact.activeSubscriberCount === 1 ? '' : 's'} currently on this plan.`
  )

  if (impact.expands) messages.push(PLAN_CATALOG_EDIT_COPY.expansions)
  if (impact.shrinks) messages.push(PLAN_CATALOG_EDIT_COPY.reductions)
  if (impact.priceChanged) messages.push(PLAN_CATALOG_EDIT_COPY.price)

  if (!impact.expands && !impact.shrinks && !impact.priceChanged) {
    messages.push('No entitlement or price changes detected. Other fields will update as saved.')
  }

  return messages
}
