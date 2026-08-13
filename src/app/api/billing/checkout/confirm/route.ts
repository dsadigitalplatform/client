export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import {
  confirmCheckoutPayment,
  confirmStripeCheckoutReturn
} from '@features/billing/services/webhooks.server'

/**
 * POST — confirm payment after checkout return.
 * Stripe: { provider:'stripe', invoiceId?, sessionId? }
 * Razorpay (legacy): razorpay_order_id / payment_id / signature
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const provider = String(body?.provider || 'stripe')

  // Fix confirm route logic - when provider is razorpay explicitly
  if (provider === 'razorpay') {
    const orderId = String(body?.razorpay_order_id || body?.orderId || '')
    const paymentId = String(body?.razorpay_payment_id || body?.paymentId || '')
    const signature = String(body?.razorpay_signature || body?.signature || '')
    const invoiceId = body?.invoiceId ? String(body.invoiceId) : null

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: 'missing_fields', message: 'Missing payment confirmation fields' },
        { status: 400 }
      )
    }

    const result = await confirmCheckoutPayment({
      db,
      tenantId,
      orderId,
      paymentId,
      signature,
      invoiceId
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  }

  const result = await confirmStripeCheckoutReturn({
    db,
    tenantId,
    invoiceId: body?.invoiceId ? String(body.invoiceId) : null,
    sessionId: body?.sessionId ? String(body.sessionId) : null
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
