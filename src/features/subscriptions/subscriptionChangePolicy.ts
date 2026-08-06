/**
 * Locked subscription change policy for DSA.
 *
 * - Upgrades / downgrades: classified by subscription amount (price) only
 * - Upgrades: immediate; starts a fresh trial on the higher plan (usage limits are not checked)
 * - Downgrades: end of current period (not available during trial; usage may warn/block when applying)
 * - Cancel: end of current period (no automatic refunds)
 * - Annual: no mid-year refund; access until period end
 * - Trials: upgrades restart the higher plan's trial; downgrades disabled; paid activation requires Super Admin mark-paid
 * - Payments: online Pay now / autopay paused; Super Admin records offline payment to activate
 *
 * Super Admin catalog edits follow the same hybrid timing — see
 * `@features/subscription-plans/planCatalogEditPolicy`.
 */

import type { PlanEntitlements } from '@features/subscription-plans/featureCatalog'
import { isUnlimited } from '@features/subscription-plans/featureCatalog'

import type { BillingInterval, UsageSnapshot } from './subscriptions.types'

export type PlanChangeKind = 'upgrade' | 'downgrade' | 'lateral' | 'same'

export type PricedPlanRef = {
  _id: string
  name: string
  priceMonthly: number
  priceYearly?: number | null
  currency?: string
  entitlements: PlanEntitlements
}

export const SUBSCRIPTION_CHANGE_POLICY = {
  upgradesApply: 'immediate' as const,
  downgradesApply: 'period_end' as const,
  cancelsApply: 'period_end' as const,
  automaticRefunds: false,
  annualMidTermRefunds: false,
  trialPlanSwitch: 'immediate' as const,
  /** Monthly → yearly starts a new yearly period immediately (when paid / applied). */
  monthlyToYearly: 'immediate' as const,
  /** Yearly → monthly waits until the current yearly period ends. */
  yearlyToMonthly: 'period_end' as const
}

export const SUBSCRIPTION_CHANGE_COPY = {
  upgrade:
    'Takes effect immediately. Remaining days on the current plan expire and a fresh trial starts on the higher plan.',
  downgrade:
    'Takes effect at the end of your current billing period. You’ll keep your current plan until then. No refund is issued for the unused time.',
  cancel:
    'You’ll keep access until the end of your current billing period. Subscriptions are not refunded for unused time (including annual plans).',
  cancelAnnual:
    'You’ll keep access until the end of your annual period. Annual plans are not refunded for unused months.',
  trialSwitch:
    'Upgrade during trial to move to a higher plan. Your current trial ends and a new trial starts on that plan. Downgrades are not available during trial.',
  trialUpgrade:
    'Upgraded. Your previous trial ended and a new trial has started on the higher plan.',
  paidUpgradeToTrial:
    'Upgraded. Remaining paid days on the previous plan expired and a fresh trial has started on the higher plan. Super Admin can mark payment received when you are ready.',
  trialNoDowngrade: 'Downgrades are not available during trial. Choose a higher plan to upgrade, or wait until after activation.',
  usageBlocked: 'Reduce usage below the target plan limits before scheduling this downgrade.',
  paymentsPending:
    'Choosing a plan does not activate paid billing. Use the trial, then ask Super Admin to mark payment received to start the paid period.'
}

export function priceForInterval(plan: PricedPlanRef, interval: BillingInterval): number {
  if (interval === 'yearly' && typeof plan.priceYearly === 'number' && Number.isFinite(plan.priceYearly)) {
    return plan.priceYearly
  }

  return Number(plan.priceMonthly) || 0
}

function limitRank(limit: number): number {
  return isUnlimited(limit) ? Number.POSITIVE_INFINITY : limit
}

export function entitlementsExpand(from: PlanEntitlements, to: PlanEntitlements): boolean {
  for (const key of Object.keys(from.limits) as Array<keyof PlanEntitlements['limits']>) {
    if (limitRank(to.limits[key]) > limitRank(from.limits[key])) return true
  }

  for (const key of Object.keys(from.modules) as Array<keyof PlanEntitlements['modules']>) {
    if (!from.modules[key] && to.modules[key]) return true
  }

  return false
}

export function entitlementsShrink(from: PlanEntitlements, to: PlanEntitlements): boolean {
  for (const key of Object.keys(from.limits) as Array<keyof PlanEntitlements['limits']>) {
    if (limitRank(to.limits[key]) < limitRank(from.limits[key])) return true
  }

  for (const key of Object.keys(from.modules) as Array<keyof PlanEntitlements['modules']>) {
    if (from.modules[key] && !to.modules[key]) return true
  }

  return false
}

/**
 * Classify a plan change for the active billing interval.
 * Same plan id → same. Higher subscription amount → upgrade.
 * Lower subscription amount → downgrade. Equal amount → lateral.
 * Entitlements are not used for upgrade/downgrade classification.
 */
export function classifyPlanChange(params: {
  currentPlanId: string
  targetPlanId: string
  current: PricedPlanRef
  target: PricedPlanRef
  billingInterval: BillingInterval
  nextBillingInterval?: BillingInterval
}): PlanChangeKind {
  const { currentPlanId, targetPlanId, current, target, billingInterval } = params
  const nextInterval = params.nextBillingInterval || billingInterval

  if (currentPlanId === targetPlanId && billingInterval === nextInterval) return 'same'

  // Interval-only moves
  if (currentPlanId === targetPlanId && billingInterval !== nextInterval) {
    if (billingInterval === 'monthly' && nextInterval === 'yearly') return 'upgrade'
    if (billingInterval === 'yearly' && nextInterval === 'monthly') return 'downgrade'
  }

  const currentPrice = priceForInterval(current, billingInterval)
  const targetPrice = priceForInterval(target, nextInterval)

  if (targetPrice > currentPrice) return 'upgrade'
  if (targetPrice < currentPrice) return 'downgrade'

  return 'lateral'
}

/** Whether this change should apply immediately per policy. */
export function appliesImmediately(kind: PlanChangeKind, inTrial: boolean): boolean {
  // Downgrades are always deferred to period end so the user sees a clear pending state.
  if (kind === 'downgrade') return false
  if (inTrial) return true
  if (kind === 'upgrade' || kind === 'lateral') return true

  return false
}

export type DowngradeUsageBlock = {
  key: 'maxUsers' | 'maxCustomers' | 'maxLeads'
  used: number
  limit: number
}

export function findDowngradeUsageBlocks(
  usage: UsageSnapshot,
  target: PlanEntitlements
): DowngradeUsageBlock[] {
  const blocks: DowngradeUsageBlock[] = []
  const checks: Array<{ key: DowngradeUsageBlock['key']; used: number; limit: number }> = [
    { key: 'maxUsers', used: usage.users, limit: target.limits.maxUsers },
    { key: 'maxCustomers', used: usage.customers, limit: target.limits.maxCustomers },
    { key: 'maxLeads', used: usage.leads, limit: target.limits.maxLeads }
  ]

  for (const check of checks) {
    if (!isUnlimited(check.limit) && check.used > check.limit) {
      blocks.push(check)
    }
  }

  return blocks
}

/**
 * Estimated upgrade proration (informational).
 * Charging is handled via Razorpay checkout / webhooks, not inline on plan change.
 */
export function estimateUpgradeProration(params: {
  currentPrice: number
  targetPrice: number
  currency: string
  periodStart: Date
  periodEnd: Date
  now?: Date
}): {
  amountDue: number | null
  currency: string
  daysRemaining: number
  periodDays: number
  paymentRequired: boolean
  note: string
} {
  const now = params.now || new Date()
  const periodMs = Math.max(1, params.periodEnd.getTime() - params.periodStart.getTime())
  const remainingMs = Math.max(0, params.periodEnd.getTime() - now.getTime())
  const periodDays = Math.max(1, Math.ceil(periodMs / (1000 * 60 * 60 * 24)))
  const daysRemaining = Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
  const unusedRatio = remainingMs / periodMs
  const theoretical = Math.max(0, (params.targetPrice - params.currentPrice) * unusedRatio)

  return {
    amountDue: theoretical > 0 ? Number(theoretical.toFixed(2)) : null,
    currency: params.currency || 'INR',
    daysRemaining,
    periodDays,
    paymentRequired: false,
    note: `Estimated prorated difference ≈ ${theoretical.toFixed(2)} ${params.currency || 'INR'} for ${daysRemaining} remaining day(s). Paid period starts after Super Admin confirms payment.`
  }
}
