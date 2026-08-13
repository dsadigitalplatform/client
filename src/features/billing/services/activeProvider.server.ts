import 'server-only'

/**
 * Active online payment provider.
 * Stripe is default while Razorpay (India) is kept for later.
 * Set BILLING_PROVIDER=razorpay when Indian Razorpay account is ready.
 */
export type OnlineBillingProvider = 'stripe' | 'razorpay'

export function getActiveBillingProvider(): OnlineBillingProvider {
  const raw = (process.env.BILLING_PROVIDER || 'stripe').trim().toLowerCase()

  return raw === 'razorpay' ? 'razorpay' : 'stripe'
}

export function appBaseUrl(): string {
  const base =
    process.env.NEXTAUTH_URL ||
    process.env.INVITE_BASE_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000'

  if (base.startsWith('http')) return base.replace(/\/+$/, '')

  return `https://${base.replace(/\/+$/, '')}`
}
