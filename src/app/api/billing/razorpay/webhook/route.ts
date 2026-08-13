export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getDb } from '@/lib/mongodb'
import { verifyRazorpayWebhookSignature } from '@features/billing/services/razorpay.server'
import { handleRazorpayWebhookEvent } from '@features/billing/services/webhooks.server'

/**
 * Razorpay webhooks — no session auth; verified via HMAC signature.
 * Configure URL: /api/billing/razorpay/webhook
 */
export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  if (!verifyRazorpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  let payload: any

  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const eventId = String(payload?.event_id || payload?.id || `${payload?.event}-${Date.now()}`)
  const eventType = String(payload?.event || 'unknown')

  const db = await getDb()
  const result = await handleRazorpayWebhookEvent({
    db,
    eventId,
    eventType,
    payload
  })

  if (!result.ok) {
    // Still 200 so Razorpay does not hammer forever on logic bugs; logged in webhookEvents
    return NextResponse.json({ received: true, status: result.status, error: result.error })
  }

  return NextResponse.json({ received: true, status: result.status })
}
