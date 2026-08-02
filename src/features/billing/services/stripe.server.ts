import 'server-only'

import Stripe from 'stripe'

let client: Stripe | null = null

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.STRIPE_PUBLISHABLE_KEY

  return key && key.trim() ? key.trim() : null
}

export function getStripeClient(): Stripe {
  if (!isStripeConfigured()) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY)')
  }

  if (!client) {
    // apiVersion omitted — SDK pins its supported default
    client = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }

  return client
}

export function constructStripeWebhookEvent(rawBody: string | Buffer, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!secret || !signature) {
    throw new Error('Stripe webhook secret or signature missing')
  }

  return getStripeClient().webhooks.constructEvent(rawBody, signature, secret)
}

export async function createStripeCustomer(params: {
  name: string
  email?: string | null
  phone?: string | null
  metadata?: Record<string, string>
}): Promise<{ id: string }> {
  const stripe = getStripeClient()
  const customer = await stripe.customers.create({
    name: params.name.slice(0, 200),
    email: params.email || undefined,
    phone: params.phone || undefined,
    metadata: params.metadata || {}
  })

  return { id: customer.id }
}

/**
 * One-time payment Checkout Session (manual renew / pay now).
 * Amount is in the currency's minor units (paise/cents).
 */
export async function createStripeCheckoutPaymentSession(params: {
  customerId: string
  amountMinor: number
  currency: string
  productName: string
  description?: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  customerEmail?: string | null
}): Promise<{ id: string; url: string | null }> {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: params.customerId,
    client_reference_id: params.metadata.tenantId?.slice(0, 200),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: Math.round(params.amountMinor),
          product_data: {
            name: params.productName.slice(0, 200),
            description: params.description?.slice(0, 500) || undefined
          }
        }
      }
    ],
    metadata: params.metadata,
    payment_intent_data: {
      metadata: params.metadata
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl
  })

  return { id: session.id, url: session.url }
}

/**
 * Recurring Checkout Session (autopay).
 */
export async function createStripeCheckoutSubscriptionSession(params: {
  customerId: string
  amountMinor: number
  currency: string
  productName: string
  interval: 'month' | 'year'
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
}): Promise<{ id: string; url: string | null }> {
  const stripe = getStripeClient()
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: params.customerId,
    client_reference_id: params.metadata.tenantId?.slice(0, 200),
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: params.currency.toLowerCase(),
          unit_amount: Math.round(params.amountMinor),
          recurring: { interval: params.interval },
          product_data: {
            name: params.productName.slice(0, 200)
          }
        }
      }
    ],
    metadata: params.metadata,
    subscription_data: {
      metadata: params.metadata
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl
  })

  return { id: session.id, url: session.url }
}
