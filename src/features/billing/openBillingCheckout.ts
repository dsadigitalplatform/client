'use client'

import type { CheckoutSessionResult } from '@features/billing/billing.types'
import { openRazorpayCheckout } from '@features/billing/openRazorpayCheckout'

/**
 * Open checkout for the active provider.
 * Stripe: redirect to hosted Checkout.
 * Razorpay: embedded Checkout modal (kept for later).
 */
export async function openBillingCheckout(session: CheckoutSessionResult): Promise<void> {
  if (session.provider === 'stripe') {
    if (!session.checkoutUrl) throw new Error('Stripe checkout URL missing')
    window.location.assign(session.checkoutUrl)

    // Navigation is in progress — never resolves in practice
    return new Promise(() => undefined)
  }

  await openRazorpayCheckout(session)
}
