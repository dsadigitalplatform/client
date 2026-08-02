import 'server-only'

import crypto from 'crypto'

import Razorpay from 'razorpay'

let client: Razorpay | null = null

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
}

export function getRazorpayKeyId(): string {
  const key = process.env.RAZORPAY_KEY_ID

  if (!key) throw new Error('RAZORPAY_KEY_ID is not configured')

  return key
}

export function getRazorpayClient(): Razorpay {
  if (!isRazorpayConfigured()) {
    throw new Error('Razorpay is not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET)')
  }

  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!
    })
  }

  return client
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET

  if (!secret || !signature) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export function verifyRazorpayPaymentSignature(params: {
  orderId: string
  paymentId: string
  signature: string
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET

  if (!secret) return false
  const payload = `${params.orderId}|${params.paymentId}`
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(params.signature))
  } catch {
    return false
  }
}

export async function createRazorpayCustomer(params: {
  name: string
  email?: string | null
  contact?: string | null
  notes?: Record<string, string>
}): Promise<{ id: string }> {
  const rz = getRazorpayClient()
  const customer = await rz.customers.create({
    name: params.name.slice(0, 120),
    email: params.email || undefined,
    contact: params.contact || undefined,
    notes: params.notes || {},
    fail_existing: 0
  } as any)

  return { id: String((customer as any).id) }
}

export async function createRazorpayOrder(params: {
  amountPaise: number
  currency?: string
  receipt: string
  notes?: Record<string, string>
  customerId?: string | null
}): Promise<{ id: string; amount: number; currency: string }> {
  const rz = getRazorpayClient()
  const order = await rz.orders.create({
    amount: Math.round(params.amountPaise),
    currency: params.currency || 'INR',
    receipt: params.receipt.slice(0, 40),
    notes: params.notes || {},
    ...(params.customerId ? { customer_id: params.customerId } : {})
  } as any)

  return {
    id: String((order as any).id),
    amount: Number((order as any).amount),
    currency: String((order as any).currency || 'INR')
  }
}

/**
 * Create (or reuse) a Razorpay subscription plan for catalog sync.
 * Period unit: monthly | yearly.
 */
export async function ensureRazorpayPlan(params: {
  name: string
  amountPaise: number
  period: 'monthly' | 'yearly'
  currency?: string
  existingPlanId?: string | null
}): Promise<string> {
  if (params.existingPlanId) return params.existingPlanId

  const rz = getRazorpayClient()
  const plan = await rz.plans.create({
    period: params.period === 'yearly' ? 'yearly' : 'monthly',
    interval: 1,
    item: {
      name: params.name.slice(0, 200),
      amount: Math.round(params.amountPaise),
      currency: params.currency || 'INR',
      description: `${params.name} (${params.period})`
    }
  } as any)

  return String((plan as any).id)
}

export async function createRazorpaySubscription(params: {
  planId: string
  customerId: string
  totalCount?: number
  notes?: Record<string, string>
}): Promise<{ id: string; status: string }> {
  const rz = getRazorpayClient()
  const sub = await rz.subscriptions.create({
    plan_id: params.planId,
    customer_id: params.customerId,
    total_count: params.totalCount ?? 120,
    customer_notify: 1,
    notes: params.notes || {}
  } as any)

  return {
    id: String((sub as any).id),
    status: String((sub as any).status || '')
  }
}
