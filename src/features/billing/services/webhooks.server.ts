import 'server-only'

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

import { ensureEligibleDiscountOnSubscription } from '@features/subscriptions/services/discountCodes.server'

import { createSubscriptionInvoice, planAmountPaise } from './invoices.server'
import { finalizeSuccessfulPayment } from './payments.server'

type WebhookHandleResult =
  | { ok: true; status: 'processed' | 'ignored' | 'duplicate' }
  | { ok: false; status: 'failed'; error: string }

/**
 * Idempotently record and process a Razorpay webhook payload.
 */
export async function handleRazorpayWebhookEvent(params: {
  db: Db
  eventId: string
  eventType: string
  payload: Record<string, any>
}): Promise<WebhookHandleResult> {
  const { db, eventId, eventType, payload } = params
  const now = new Date()

  try {
    await db.collection('webhookEvents').insertOne({
      provider: 'razorpay',
      eventId,
      eventType,
      payload,
      status: 'received',
      errorMessage: null,
      processedAt: null,
      createdAt: now
    })
  } catch (err: any) {
    if (err?.code === 11000) {
      return { ok: true, status: 'duplicate' }
    }

    throw err
  }

  try {
    const result = await dispatchRazorpayEvent(db, eventType, payload)

    await db.collection('webhookEvents').updateOne(
      { eventId },
      {
        $set: {
          status: result.status,
          processedAt: new Date(),
          errorMessage: result.status === 'failed' ? result.error : null
        }
      }
    )

    if (result.status === 'failed') {
      return { ok: false, status: 'failed', error: result.error || 'processing_failed' }
    }

    return { ok: true, status: result.status }
  } catch (e: any) {
    const message = String(e?.message || e).slice(0, 500)

    await db.collection('webhookEvents').updateOne(
      { eventId },
      {
        $set: {
          status: 'failed',
          errorMessage: message,
          processedAt: new Date()
        }
      }
    )

    return { ok: false, status: 'failed', error: message }
  }
}

async function dispatchRazorpayEvent(
  db: Db,
  eventType: string,
  payload: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  if (eventType === 'payment.captured') {
    return processPaymentCaptured(db, payload)
  }

  if (eventType === 'payment.failed') {
    return processPaymentFailed(db, payload)
  }

  if (
    eventType === 'subscription.charged' ||
    eventType === 'subscription.activated' ||
    eventType === 'invoice.paid'
  ) {
    return processSubscriptionCharged(db, payload, eventType)
  }

  return { status: 'ignored' }
}

function notesOf(entity: Record<string, any> | null | undefined): Record<string, string> {
  const notes = entity?.notes

  if (!notes || typeof notes !== 'object') return {}
  const out: Record<string, string> = {}

  for (const [k, v] of Object.entries(notes)) {
    if (v != null) out[k] = String(v)
  }

  return out
}

async function processPaymentCaptured(
  db: Db,
  payload: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const paymentEntity = payload?.payload?.payment?.entity || payload?.payload?.payment || null

  if (!paymentEntity?.id) return { status: 'ignored' }

  const paymentId = String(paymentEntity.id)
  const orderId = paymentEntity.order_id ? String(paymentEntity.order_id) : null
  const amountPaise = Number(paymentEntity.amount) || 0
  const method = paymentEntity.method ? String(paymentEntity.method) : null
  const notes = notesOf(paymentEntity)

  let invoiceId = notes.invoiceId && ObjectId.isValid(notes.invoiceId) ? notes.invoiceId : null
  let tenantId = notes.tenantId && ObjectId.isValid(notes.tenantId) ? notes.tenantId : null
  let subscriptionId =
    notes.subscriptionId && ObjectId.isValid(notes.subscriptionId) ? notes.subscriptionId : null

  // Resolve via order id on invoice
  if ((!invoiceId || !tenantId) && orderId) {
    const inv = await db.collection('invoices').findOne({ externalOrderId: orderId })

    if (inv) {
      invoiceId = String(inv._id)
      tenantId = String(inv.tenantId)
      subscriptionId = inv.subscriptionId ? String(inv.subscriptionId) : subscriptionId
    }
  }

  if (!invoiceId || !tenantId || !subscriptionId) {
    return { status: 'ignored' }
  }

  // Already processed?
  const existingPay = await db.collection('payments').findOne({ externalPaymentId: paymentId })

  if (existingPay?.status === 'captured') {
    return { status: 'processed' }
  }

  const inv = await db.collection('invoices').findOne({ _id: new ObjectId(invoiceId) })

  if (inv?.status === 'paid') {
    return { status: 'processed' }
  }

  await finalizeSuccessfulPayment({
    db,
    tenantId: new ObjectId(tenantId),
    subscriptionId: new ObjectId(subscriptionId),
    invoiceId: new ObjectId(invoiceId),
    provider: 'razorpay',
    amountPaise: amountPaise || Number(inv?.totalPaise) || 0,
    method,
    externalPaymentId: paymentId,
    externalOrderId: orderId,
    rawProviderPayload: paymentEntity
  })

  return { status: 'processed' }
}

async function processPaymentFailed(
  db: Db,
  payload: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const paymentEntity = payload?.payload?.payment?.entity || null

  if (!paymentEntity?.id) return { status: 'ignored' }

  const notes = notesOf(paymentEntity)
  const tenantId = notes.tenantId && ObjectId.isValid(notes.tenantId) ? new ObjectId(notes.tenantId) : null
  const subscriptionId =
    notes.subscriptionId && ObjectId.isValid(notes.subscriptionId)
      ? new ObjectId(notes.subscriptionId)
      : null
  const invoiceId =
    notes.invoiceId && ObjectId.isValid(notes.invoiceId) ? new ObjectId(notes.invoiceId) : null

  if (tenantId && subscriptionId) {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: subscriptionId },
      {
        $set: {
          lastPaymentStatus: 'failed',
          updatedAt: new Date()
        }
      }
    )
  }

  if (tenantId) {
    const { createPaymentRecord } = await import('./payments.server')

    await createPaymentRecord({
      db,
      tenantId,
      subscriptionId,
      invoiceId,
      provider: 'razorpay',
      amountPaise: Number(paymentEntity.amount) || 0,
      status: 'failed',
      method: paymentEntity.method ? String(paymentEntity.method) : null,
      externalPaymentId: String(paymentEntity.id),
      externalOrderId: paymentEntity.order_id ? String(paymentEntity.order_id) : null,
      failureCode: paymentEntity.error_code ? String(paymentEntity.error_code) : null,
      failureMessage: paymentEntity.error_description
        ? String(paymentEntity.error_description)
        : null,
      rawProviderPayload: paymentEntity
    })
  }

  return { status: 'processed' }
}

async function processSubscriptionCharged(
  db: Db,
  payload: Record<string, any>,
  eventType: string
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const subEntity =
    payload?.payload?.subscription?.entity ||
    payload?.payload?.subscription ||
    null
  const paymentEntity = payload?.payload?.payment?.entity || null

  const razorpaySubId = subEntity?.id ? String(subEntity.id) : null
  const notes = notesOf(subEntity)

  let subDoc = razorpaySubId
    ? await db.collection('tenantSubscriptions').findOne({ externalSubscriptionId: razorpaySubId })
    : null

  if (!subDoc && notes.subscriptionId && ObjectId.isValid(notes.subscriptionId)) {
    subDoc = await db.collection('tenantSubscriptions').findOne({
      _id: new ObjectId(notes.subscriptionId)
    })
  }

  if (!subDoc) {
    return { status: 'ignored' }
  }

  if (eventType === 'subscription.activated') {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: subDoc._id },
      {
        $set: {
          externalSubscriptionStatus: subEntity?.status ? String(subEntity.status) : 'active',
          paymentProvider: 'razorpay',
          updatedAt: new Date()
        }
      }
    )

    return { status: 'processed' }
  }

  // Charged: create invoice + finalize if we have a payment
  const paymentId = paymentEntity?.id ? String(paymentEntity.id) : null

  if (paymentId) {
    const existing = await db.collection('payments').findOne({ externalPaymentId: paymentId })

    if (existing?.status === 'captured') return { status: 'processed' }
  }

  const plan = await db.collection('subscriptionPlans').findOne({ _id: subDoc.planId })

  if (!plan) return { status: 'failed', error: 'plan_not_found' }

  const interval = (subDoc.billingInterval || 'monthly') as 'monthly' | 'yearly'
  const now = new Date()
  const periodStart =
    subDoc.currentPeriodEnd instanceof Date && subDoc.currentPeriodEnd.getTime() > now.getTime()
      ? subDoc.currentPeriodEnd
      : now
  const days = interval === 'yearly' ? 365 : 30
  const periodEnd = new Date(periodStart.getTime() + days * 24 * 60 * 60 * 1000)

  const tenant = await db.collection('tenants').findOne({ _id: subDoc.tenantId })
  const discountForInvoice = await ensureEligibleDiscountOnSubscription({
    db,
    tenantId: subDoc.tenantId,
    subscription: subDoc as Record<string, any>,
    plan: plan as any
  })
  const invoice = await createSubscriptionInvoice({
    db,
    tenantId: subDoc.tenantId,
    subscriptionId: subDoc._id,
    plan: plan as any,
    billingInterval: interval,
    periodStart,
    periodEnd,
    provider: 'razorpay',
    discountSnapshot: discountForInvoice.snapshot || null,
    billingContactEmail: (tenant as any)?.billingEmail || null,
    status: 'open'
  })

  const amountPaise =
    (paymentEntity?.amount && Number(paymentEntity.amount)) ||
    invoice.totalPaise ||
    planAmountPaise(plan as any, interval)

  await finalizeSuccessfulPayment({
    db,
    tenantId: subDoc.tenantId,
    subscriptionId: subDoc._id,
    invoiceId: new ObjectId(invoice._id),
    provider: 'razorpay',
    amountPaise,
    method: paymentEntity?.method ? String(paymentEntity.method) : 'upi',
    externalPaymentId: paymentId,
    rawProviderPayload: { subscription: subEntity, payment: paymentEntity }
  })

  await db.collection('tenantSubscriptions').updateOne(
    { _id: subDoc._id },
    {
      $set: {
        externalSubscriptionStatus: subEntity?.status ? String(subEntity.status) : 'active',
        updatedAt: new Date()
      }
    }
  )

  return { status: 'processed' }
}

/**
 * Client-side checkout success confirmation (still verifies signature).
 * Prefer webhooks for access unlock; this is a fast-path when webhook is delayed.
 */
export async function confirmCheckoutPayment(params: {
  db: Db
  tenantId: ObjectId
  orderId: string
  paymentId: string
  signature: string
  invoiceId?: string | null
}): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const { verifyRazorpayPaymentSignature } = await import('./razorpay.server')

  if (
    !verifyRazorpayPaymentSignature({
      orderId: params.orderId,
      paymentId: params.paymentId,
      signature: params.signature
    })
  ) {
    return { ok: false, error: 'invalid_signature', message: 'Payment signature verification failed' }
  }

  const existing = await params.db.collection('payments').findOne({
    externalPaymentId: params.paymentId
  })

  if (existing?.status === 'captured') {
    return { ok: true }
  }

  let invoice = params.invoiceId && ObjectId.isValid(params.invoiceId)
    ? await params.db.collection('invoices').findOne({
        _id: new ObjectId(params.invoiceId),
        tenantId: params.tenantId
      })
    : await params.db.collection('invoices').findOne({
        externalOrderId: params.orderId,
        tenantId: params.tenantId
      })

  if (!invoice) {
    return { ok: false, error: 'invoice_not_found', message: 'Invoice not found for this payment' }
  }

  if (invoice.status === 'paid') return { ok: true }

  if (!invoice.subscriptionId) {
    return { ok: false, error: 'no_subscription', message: 'Invoice is not linked to a subscription' }
  }

  await finalizeSuccessfulPayment({
    db: params.db,
    tenantId: params.tenantId,
    subscriptionId: invoice.subscriptionId,
    invoiceId: invoice._id,
    provider: 'razorpay',
    amountPaise: Number(invoice.totalPaise) || 0,
    method: null,
    externalPaymentId: params.paymentId,
    externalOrderId: params.orderId
  })

  return { ok: true }
}

/**
 * Idempotently record and process a Stripe webhook event.
 */
export async function handleStripeWebhookEvent(params: {
  db: Db
  eventId: string
  eventType: string
  payload: Record<string, any>
}): Promise<WebhookHandleResult> {
  const { db, eventId, eventType, payload } = params
  const now = new Date()

  try {
    await db.collection('webhookEvents').insertOne({
      provider: 'stripe',
      eventId,
      eventType,
      payload,
      status: 'received',
      errorMessage: null,
      processedAt: null,
      createdAt: now
    })
  } catch (err: any) {
    if (err?.code === 11000) {
      return { ok: true, status: 'duplicate' }
    }

    throw err
  }

  try {
    const result = await dispatchStripeEvent(db, eventType, payload)

    await db.collection('webhookEvents').updateOne(
      { eventId },
      {
        $set: {
          status: result.status,
          processedAt: new Date(),
          errorMessage: result.status === 'failed' ? result.error || null : null
        }
      }
    )

    if (result.status === 'failed') {
      return { ok: false, status: 'failed', error: result.error || 'processing_failed' }
    }

    return { ok: true, status: result.status }
  } catch (e: any) {
    const message = String(e?.message || e).slice(0, 500)

    await db.collection('webhookEvents').updateOne(
      { eventId },
      {
        $set: {
          status: 'failed',
          errorMessage: message,
          processedAt: new Date()
        }
      }
    )

    return { ok: false, status: 'failed', error: message }
  }
}

async function dispatchStripeEvent(
  db: Db,
  eventType: string,
  payload: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const data = payload?.data || payload

  if (eventType === 'checkout.session.completed') {
    return processStripeCheckoutCompleted(db, data)
  }

  if (eventType === 'invoice.paid' || eventType === 'invoice.payment_succeeded') {
    return processStripeInvoicePaid(db, data)
  }

  if (eventType === 'customer.subscription.updated' || eventType === 'customer.subscription.deleted') {
    return processStripeSubscriptionLifecycle(db, data, eventType)
  }

  if (eventType === 'payment_intent.payment_failed') {
    return processStripePaymentFailed(db, data)
  }

  return { status: 'ignored' }
}

async function processStripeCheckoutCompleted(
  db: Db,
  eventObject: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  // Stripe Event.data.object OR already-unwrapped session
  const session = eventObject?.object || eventObject

  if (!session?.id) return { status: 'ignored' }

  const metadata = (session.metadata || {}) as Record<string, string>
  const invoiceId = metadata.invoiceId
  const tenantId = metadata.tenantId
  const subscriptionId = metadata.subscriptionId
  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id
        ? String(session.payment_intent.id)
        : null
  const stripeSubId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id
        ? String(session.subscription.id)
        : null

  if (!invoiceId || !ObjectId.isValid(invoiceId) || !tenantId || !ObjectId.isValid(tenantId)) {
    return { status: 'ignored' }
  }

  if (!subscriptionId || !ObjectId.isValid(subscriptionId)) {
    return { status: 'ignored' }
  }

  const externalPaymentId = paymentIntentId || String(session.id)
  const existing = await db.collection('payments').findOne({ externalPaymentId })

  if (existing?.status === 'captured') {
    if (stripeSubId) {
      await db.collection('tenantSubscriptions').updateOne(
        { _id: new ObjectId(subscriptionId) },
        {
          $set: {
            externalSubscriptionId: stripeSubId,
            externalSubscriptionStatus: 'active',
            ...(session.mode === 'subscription' ? { renewalMode: 'auto' } : {}),
            updatedAt: new Date()
          }
        }
      )
    }

    return { status: 'processed' }
  }

  const inv = await db.collection('invoices').findOne({ _id: new ObjectId(invoiceId) })

  if (inv?.status === 'paid') return { status: 'processed' }

  const amountPaise =
    typeof session.amount_total === 'number' ? session.amount_total : Number(inv?.totalPaise) || 0

  await finalizeSuccessfulPayment({
    db,
    tenantId: new ObjectId(tenantId),
    subscriptionId: new ObjectId(subscriptionId),
    invoiceId: new ObjectId(invoiceId),
    provider: 'stripe',
    amountPaise,
    method: 'card',
    externalPaymentId,
    externalOrderId: String(session.id),
    rawProviderPayload: session
  })

  if (stripeSubId || session.mode === 'subscription') {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: new ObjectId(subscriptionId) },
      {
        $set: {
          paymentProvider: 'stripe',
          renewalMode: 'auto',
          ...(stripeSubId
            ? { externalSubscriptionId: stripeSubId, externalSubscriptionStatus: 'active' }
            : {}),
          updatedAt: new Date()
        }
      }
    )
  }

  return { status: 'processed' }
}

async function processStripeInvoicePaid(
  db: Db,
  eventObject: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const stripeInvoice = eventObject?.object || eventObject
  const stripeSubId =
    typeof stripeInvoice.subscription === 'string'
      ? stripeInvoice.subscription
      : stripeInvoice.subscription?.id
        ? String(stripeInvoice.subscription.id)
        : null

  if (!stripeSubId) return { status: 'ignored' }

  // First checkout already handled via checkout.session.completed — skip billing_reason=subscription_create
  if (stripeInvoice.billing_reason === 'subscription_create') {
    return { status: 'ignored' }
  }

  const subDoc = await db.collection('tenantSubscriptions').findOne({
    externalSubscriptionId: stripeSubId
  })

  if (!subDoc) return { status: 'ignored' }

  const paymentIntentId =
    typeof stripeInvoice.payment_intent === 'string'
      ? stripeInvoice.payment_intent
      : stripeInvoice.payment_intent?.id
        ? String(stripeInvoice.payment_intent.id)
        : String(stripeInvoice.id)

  const existing = await db.collection('payments').findOne({ externalPaymentId: paymentIntentId })

  if (existing?.status === 'captured') return { status: 'processed' }

  const plan = await db.collection('subscriptionPlans').findOne({ _id: subDoc.planId })

  if (!plan) return { status: 'failed', error: 'plan_not_found' }

  const interval = (subDoc.billingInterval || 'monthly') as 'monthly' | 'yearly'
  const now = new Date()
  const periodStart =
    subDoc.currentPeriodEnd instanceof Date && subDoc.currentPeriodEnd.getTime() > now.getTime()
      ? subDoc.currentPeriodEnd
      : now
  const days = interval === 'yearly' ? 365 : 30
  const periodEnd = new Date(periodStart.getTime() + days * 24 * 60 * 60 * 1000)
  const tenant = await db.collection('tenants').findOne({ _id: subDoc.tenantId })
  const discountForInvoice = await ensureEligibleDiscountOnSubscription({
    db,
    tenantId: subDoc.tenantId,
    subscription: subDoc as Record<string, any>,
    plan: plan as any
  })

  const invoice = await createSubscriptionInvoice({
    db,
    tenantId: subDoc.tenantId,
    subscriptionId: subDoc._id,
    plan: plan as any,
    billingInterval: interval,
    periodStart,
    periodEnd,
    provider: 'stripe',
    discountSnapshot: discountForInvoice.snapshot || null,
    billingContactEmail: (tenant as any)?.billingEmail || null,
    status: 'open'
  })

  const amountPaise =
    typeof stripeInvoice.amount_paid === 'number'
      ? stripeInvoice.amount_paid
      : invoice.totalPaise || planAmountPaise(plan as any, interval)

  await finalizeSuccessfulPayment({
    db,
    tenantId: subDoc.tenantId,
    subscriptionId: subDoc._id,
    invoiceId: new ObjectId(invoice._id),
    provider: 'stripe',
    amountPaise,
    method: 'card',
    externalPaymentId: paymentIntentId,
    externalOrderId: String(stripeInvoice.id),
    rawProviderPayload: stripeInvoice
  })

  return { status: 'processed' }
}

async function processStripeSubscriptionLifecycle(
  db: Db,
  eventObject: Record<string, any>,
  eventType: string
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const stripeSub = eventObject?.object || eventObject
  const stripeSubId = stripeSub?.id ? String(stripeSub.id) : null

  if (!stripeSubId) return { status: 'ignored' }

  const subDoc = await db.collection('tenantSubscriptions').findOne({
    externalSubscriptionId: stripeSubId
  })

  if (!subDoc) {
    // May arrive before we store id — try metadata
    const metaSubId = stripeSub?.metadata?.subscriptionId

    if (metaSubId && ObjectId.isValid(metaSubId)) {
      await db.collection('tenantSubscriptions').updateOne(
        { _id: new ObjectId(metaSubId) },
        {
          $set: {
            externalSubscriptionId: stripeSubId,
            externalSubscriptionStatus: String(stripeSub.status || ''),
            paymentProvider: 'stripe',
            updatedAt: new Date()
          }
        }
      )

      return { status: 'processed' }
    }

    return { status: 'ignored' }
  }

  const $set: Record<string, unknown> = {
    externalSubscriptionStatus: String(stripeSub.status || ''),
    paymentProvider: 'stripe',
    updatedAt: new Date()
  }

  if (eventType === 'customer.subscription.deleted') {
    $set.cancelAtPeriodEnd = true
    $set.canceledAt = new Date()
  }

  await db.collection('tenantSubscriptions').updateOne({ _id: subDoc._id }, { $set })

  return { status: 'processed' }
}

async function processStripePaymentFailed(
  db: Db,
  eventObject: Record<string, any>
): Promise<{ status: 'processed' | 'ignored' | 'failed'; error?: string }> {
  const pi = eventObject?.object || eventObject
  const metadata = (pi?.metadata || {}) as Record<string, string>
  const subscriptionId =
    metadata.subscriptionId && ObjectId.isValid(metadata.subscriptionId)
      ? new ObjectId(metadata.subscriptionId)
      : null
  const tenantId =
    metadata.tenantId && ObjectId.isValid(metadata.tenantId) ? new ObjectId(metadata.tenantId) : null

  if (subscriptionId) {
    await db.collection('tenantSubscriptions').updateOne(
      { _id: subscriptionId },
      { $set: { lastPaymentStatus: 'failed', updatedAt: new Date() } }
    )
  }

  if (tenantId) {
    const { createPaymentRecord } = await import('./payments.server')

    await createPaymentRecord({
      db,
      tenantId,
      subscriptionId,
      invoiceId:
        metadata.invoiceId && ObjectId.isValid(metadata.invoiceId)
          ? new ObjectId(metadata.invoiceId)
          : null,
      provider: 'stripe',
      amountPaise: Number(pi.amount) || 0,
      status: 'failed',
      method: 'card',
      externalPaymentId: pi.id ? String(pi.id) : null,
      failureCode: pi.last_payment_error?.code ? String(pi.last_payment_error.code) : null,
      failureMessage: pi.last_payment_error?.message
        ? String(pi.last_payment_error.message)
        : null,
      rawProviderPayload: pi
    })
  }

  return { status: 'processed' }
}

/**
 * Fast-path after Stripe redirect: if webhook already ran, no-op; else verify session paid.
 */
export async function confirmStripeCheckoutReturn(params: {
  db: Db
  tenantId: ObjectId
  invoiceId?: string | null
  sessionId?: string | null
}): Promise<{ ok: true } | { ok: false; error: string; message: string }> {
  const { getStripeClient } = await import('./stripe.server')

  let session: any = null

  if (params.sessionId) {
    session = await getStripeClient().checkout.sessions.retrieve(params.sessionId)
  } else if (params.invoiceId && ObjectId.isValid(params.invoiceId)) {
    const inv = await params.db.collection('invoices').findOne({
      _id: new ObjectId(params.invoiceId),
      tenantId: params.tenantId
    })

    if (inv?.externalOrderId) {
      session = await getStripeClient().checkout.sessions.retrieve(String(inv.externalOrderId))
    }
  }

  if (!session) {
    return { ok: false, error: 'session_not_found', message: 'Checkout session not found' }
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { ok: false, error: 'not_paid', message: 'Payment is not complete yet' }
  }

  // Reuse the same processor as the webhook
  const result = await processStripeCheckoutCompleted(params.db, { object: session })

  if (result.status === 'failed') {
    return { ok: false, error: result.error || 'failed', message: 'Could not finalize payment' }
  }

  return { ok: true }
}
