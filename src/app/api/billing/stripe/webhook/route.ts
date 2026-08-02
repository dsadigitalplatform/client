export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getDb } from '@/lib/mongodb'
import { constructStripeWebhookEvent } from '@features/billing/services/stripe.server'
import { handleStripeWebhookEvent } from '@features/billing/services/webhooks.server'

/**
 * Stripe webhooks — verified via Stripe-Signature.
 * Configure endpoint: /api/billing/stripe/webhook
 * Events: checkout.session.completed, invoice.paid, customer.subscription.*, payment_intent.payment_failed
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('stripe-signature')

  let event: { id: string; type: string; data?: unknown }

  try {
    event = constructStripeWebhookEvent(rawBody, signature) as any
  } catch (e: any) {
    return NextResponse.json(
      { error: 'invalid_signature', message: String(e?.message || e) },
      { status: 400 }
    )
  }

  const db = await getDb()
  const result = await handleStripeWebhookEvent({
    db,
    eventId: String(event.id),
    eventType: String(event.type),
    payload: event as any
  })

  if (!result.ok) {
    return NextResponse.json({ received: true, status: result.status, error: result.error })
  }

  return NextResponse.json({ received: true, status: result.status })
}
