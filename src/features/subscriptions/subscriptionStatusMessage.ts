import type { RenewalMode, SubscriptionStatus } from './subscriptions.types'

export type SubscriptionStatusSummary = {
  status: SubscriptionStatus
  renewalMode: RenewalMode
  currentPeriodEnd: string | null
  trialEndsAt: string | null
  cancelAtPeriodEnd: boolean
  daysLeftInTrial?: number | null
  inTrial?: boolean
  pendingPlanName?: string | null
  pendingChangeEffectiveAt?: string | null
}

function ordinal(day: number) {
  const mod100 = day % 100

  if (mod100 >= 11 && mod100 <= 13) return `${day}th`

  switch (day % 10) {
    case 1:
      return `${day}st`
    case 2:
      return `${day}nd`
    case 3:
      return `${day}rd`
    default:
      return `${day}th`
  }
}

/** Days remaining until `iso` (ceil). Negative if already past. */
export function daysUntil(iso: string | null | undefined, now = new Date()): number | null {
  if (!iso) return null
  const target = new Date(iso)

  if (Number.isNaN(target.getTime())) return null

  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

/** Compact due date, e.g. "1st Sep" or "1st Apr 2027" when year differs. */
export function formatSubscriptionDueDate(iso: string | null | undefined, now = new Date()): string | null {
  if (!iso) return null
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return null

  const day = ordinal(d.getDate())
  const month = d.toLocaleDateString('en-IN', { month: 'short' })
  const year = d.getFullYear()

  if (year !== now.getFullYear()) return `${day} ${month} ${year}`

  return `${day} ${month}`
}

function trialExpiresMessage(daysLeft: number): string {
  if (daysLeft <= 0) return 'Trial expires today'
  if (daysLeft === 1) return 'Trial expires tomorrow'

  return `Trial expires in ${daysLeft} days`
}

/**
 * Short, intuitive status line for navbar chip + billing page.
 * Priority: trial → cancel scheduled → pending switch → past due → auto/manual renew → expired.
 */
export function getSubscriptionStatusMessage(
  summary: SubscriptionStatusSummary | null | undefined,
  now = new Date()
): string | null {
  if (!summary?.status) return null

  const inTrial = summary.inTrial ?? summary.status === 'trialing'
  const trialEnd = summary.trialEndsAt || summary.currentPeriodEnd
  const daysLeft =
    typeof summary.daysLeftInTrial === 'number'
      ? summary.daysLeftInTrial
      : inTrial
        ? Math.max(0, daysUntil(trialEnd, now) ?? 0)
        : null

  if (inTrial || summary.status === 'trialing') {
    if (daysLeft == null) {
      const date = formatSubscriptionDueDate(trialEnd, now)

      return date ? `Trial expires by ${date}` : 'Trial in progress'
    }

    return trialExpiresMessage(daysLeft)
  }

  if (summary.cancelAtPeriodEnd) {
    const date = formatSubscriptionDueDate(summary.currentPeriodEnd, now)

    return date ? `Access ends ${date}` : 'Cancellation scheduled'
  }

  if (summary.pendingPlanName) {
    const date = formatSubscriptionDueDate(summary.pendingChangeEffectiveAt || summary.currentPeriodEnd, now)

    return date ? `Switches to ${summary.pendingPlanName} on ${date}` : `Switching to ${summary.pendingPlanName}`
  }

  if (summary.status === 'past_due') {
    const date = formatSubscriptionDueDate(summary.currentPeriodEnd, now)

    return date ? `Payment overdue · renew by ${date}` : 'Payment overdue'
  }

  if (summary.status === 'active') {
    const date = formatSubscriptionDueDate(summary.currentPeriodEnd, now)

    if (!date) return summary.renewalMode === 'auto' ? 'Auto renewal enabled' : 'Manual renewal'

    return summary.renewalMode === 'auto' ? `Auto renewal by ${date}` : `Renewal due by ${date}`
  }

  if (summary.status === 'canceled' || summary.status === 'expired') {
    return 'Subscription expired'
  }

  if (summary.status === 'incomplete') {
    return 'Subscription incomplete'
  }

  return null
}

export function toSubscriptionStatusSummary(input: {
  status?: SubscriptionStatus | null
  renewalMode?: RenewalMode | null
  currentPeriodEnd?: string | null
  trialEndsAt?: string | null
  cancelAtPeriodEnd?: boolean | null
  daysLeftInTrial?: number | null
  inTrial?: boolean | null
  pendingPlanName?: string | null
  pendingChangeEffectiveAt?: string | null
}): SubscriptionStatusSummary | null {
  if (!input.status) return null

  return {
    status: input.status,
    renewalMode: input.renewalMode || 'manual',
    currentPeriodEnd: input.currentPeriodEnd || null,
    trialEndsAt: input.trialEndsAt || null,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    daysLeftInTrial: input.daysLeftInTrial ?? null,
    inTrial: input.inTrial ?? input.status === 'trialing',
    pendingPlanName: input.pendingPlanName || null,
    pendingChangeEffectiveAt: input.pendingChangeEffectiveAt || null
  }
}

/** Show header countdown when due within this many days (or already expired / overdue). */
export const SUBSCRIPTION_REMINDER_DAYS = 7

/** Show post-login trial expiry dialog when trial ends within this many days. */
export const SUBSCRIPTION_TRIAL_DIALOG_DAYS = 3

export type SubscriptionRenewalReminderKind = 'trial' | 'renewal' | 'access_end' | 'overdue' | 'expired'

export type SubscriptionRenewalReminder = {
  /** Whole days remaining; 0 = due today; negative = past due/expired. */
  daysLeft: number
  severity: 'warning' | 'error'
  kind: SubscriptionRenewalReminderKind
  dueAt: string | null
}

/**
 * Compact renewal/expiry reminder for the navbar.
 * Visible from ~1 week before due, and whenever overdue or expired.
 */
export function getSubscriptionRenewalReminder(
  summary: SubscriptionStatusSummary | null | undefined,
  now = new Date(),
  withinDays = SUBSCRIPTION_REMINDER_DAYS
): SubscriptionRenewalReminder | null {
  if (!summary?.status) return null

  if (summary.status === 'canceled' || summary.status === 'expired') {
    const daysLeft = daysUntil(summary.currentPeriodEnd, now) ?? 0

    return {
      daysLeft: Math.min(daysLeft, 0),
      severity: 'error',
      kind: 'expired',
      dueAt: summary.currentPeriodEnd
    }
  }

  if (summary.status === 'past_due') {
    const daysLeft = daysUntil(summary.currentPeriodEnd, now) ?? 0

    return {
      daysLeft,
      severity: 'error',
      kind: 'overdue',
      dueAt: summary.currentPeriodEnd
    }
  }

  const inTrial = summary.inTrial ?? summary.status === 'trialing'

  if (inTrial || summary.status === 'trialing') {
    const trialEnd = summary.trialEndsAt || summary.currentPeriodEnd
    const daysLeft =
      typeof summary.daysLeftInTrial === 'number' ? summary.daysLeftInTrial : (daysUntil(trialEnd, now) ?? 0)

    if (daysLeft > withinDays) return null

    return {
      daysLeft: Math.max(0, daysLeft),
      severity: daysLeft <= 1 ? 'error' : 'warning',
      kind: 'trial',
      dueAt: trialEnd
    }
  }

  if (summary.status !== 'active') return null

  const daysLeft = daysUntil(summary.currentPeriodEnd, now)

  if (daysLeft == null || daysLeft > withinDays) return null

  const kind: SubscriptionRenewalReminderKind = summary.cancelAtPeriodEnd ? 'access_end' : 'renewal'

  return {
    daysLeft: Math.max(0, daysLeft),
    severity: daysLeft <= 1 || summary.cancelAtPeriodEnd ? 'error' : 'warning',
    kind,
    dueAt: summary.currentPeriodEnd
  }
}
