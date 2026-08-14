import { formatPlanMoney } from '@features/subscription-plans/currencies'

import type { BillingInterval, DiscountSnapshot, SubscriptionPricing } from '../subscriptions.types'

export function planPriceForInterval(
  plan: { priceMonthly?: number | null; priceYearly?: number | null } | null | undefined,
  interval: BillingInterval
): number {
  if (!plan) return 0

  if (interval === 'yearly' && typeof plan.priceYearly === 'number' && Number.isFinite(plan.priceYearly)) {
    return plan.priceYearly
  }

  return Number(plan.priceMonthly) || 0
}

export function discountAmountForPrice(price: number, snapshot: DiscountSnapshot | null | undefined): number {
  if (!snapshot || !Number.isFinite(price) || price <= 0) return 0

  const value = Number(snapshot.value)

  if (!Number.isFinite(value) || value <= 0) return 0

  if (snapshot.type === 'percent') {
    return Math.min(price, Math.round((price * value) / 100))
  }

  if (snapshot.type === 'fixed') {
    return Math.min(price, value)
  }

  return 0
}

export function formatDiscountCaption(
  snapshot: DiscountSnapshot | null | undefined,
  currency?: string | null
): string | null {
  if (!snapshot?.code) return null

  const off =
    snapshot.type === 'percent'
      ? `${snapshot.value}% off`
      : `${formatPlanMoney(snapshot.value, snapshot.currency || currency)} off`

  return `${snapshot.code} · ${off}`
}

export function buildSubscriptionPricing(params: {
  originalAmount: number
  currency: string
  interval: BillingInterval
  snapshot?: DiscountSnapshot | null
  discountName?: string | null
}): SubscriptionPricing {
  const discountAmount = discountAmountForPrice(params.originalAmount, params.snapshot)
  const payableAmount = Math.max(0, params.originalAmount - discountAmount)
  const intervalSuffix = params.interval === 'yearly' ? '/ year' : '/ month'
  const originalLabel = formatPlanMoney(params.originalAmount, params.currency)
  const payableLabel = formatPlanMoney(payableAmount, params.currency)
  const snapshot = discountAmount > 0 ? params.snapshot || null : null

  return {
    currency: params.currency,
    interval: params.interval,
    originalAmount: params.originalAmount,
    discountAmount,
    payableAmount,
    originalLabel,
    payableLabel,
    payLabel: `${payableLabel} ${intervalSuffix}`,
    intervalSuffix,
    discount: snapshot,
    discountName: params.discountName || null,
    discountCaption: formatDiscountCaption(snapshot, params.currency)
  }
}
