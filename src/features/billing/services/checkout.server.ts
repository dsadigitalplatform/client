import 'server-only'

import type { Db, ObjectId as ObjectIdType } from 'mongodb'
import { ObjectId } from 'mongodb'

import type { CheckoutSessionResult } from '../billing.types'
import { appBaseUrl, getActiveBillingProvider } from './activeProvider.server'
import { createSubscriptionInvoice, planAmountPaise } from './invoices.server'
import { ensureEligibleDiscountOnSubscription } from '@features/subscriptions/services/discountCodes.server'
import {
  createRazorpayCustomer,
  createRazorpayOrder,
  createRazorpaySubscription,
  ensureRazorpayPlan,
  getRazorpayKeyId,
  isRazorpayConfigured
} from './razorpay.server'
import {
  createStripeCheckoutPaymentSession,
  createStripeCheckoutSubscriptionSession,
  createStripeCustomer,
  getStripePublishableKey,
  isStripeConfigured
} from './stripe.server'

async function resolveBillingContact(db: Db, sub: Record<string, any>) {
  const userId = sub.billingContactUserId
  if (!userId) return { email: null as string | null, name: null as string | null, contact: null as string | null }
  const user = await db.collection('users').findOne(
    { _id: userId },
    { projection: { email: 1, name: 1, phone: 1, mobile: 1 } }
  )

  return {
    email: typeof user?.email === 'string' ? user.email : null,
    name: typeof user?.name === 'string' ? user.name : null,
    contact:
      (typeof (user as any)?.phone === 'string' && (user as any).phone) ||
      (typeof (user as any)?.mobile === 'string' && (user as any).mobile) ||
      null
  }
}

async function ensureBillingCustomer(params: {
  db: Db
  tenantId: ObjectIdType
  name: string
  email: string | null
  contact: string | null
  provider: 'stripe' | 'razorpay'
}): Promise<{ externalCustomerId: string }> {
  const existing = await params.db.collection('billingCustomers').findOne({ tenantId: params.tenantId })

  if (existing?.externalCustomerId && existing.provider === params.provider) {
    return { externalCustomerId: String(existing.externalCustomerId) }
  }

  const created =
    params.provider === 'stripe'
      ? await createStripeCustomer({
          name: params.name,
          email: params.email,
          phone: params.contact,
          metadata: { tenantId: String(params.tenantId) }
        })
      : await createRazorpayCustomer({
          name: params.name,
          email: params.email,
          contact: params.contact,
          notes: { tenantId: String(params.tenantId) }
        })

  const now = new Date()

  await params.db.collection('billingCustomers').updateOne(
    { tenantId: params.tenantId },
    {
      $set: {
        provider: params.provider,
        externalCustomerId: created.id,
        email: params.email,
        contact: params.contact,
        updatedAt: now
      },
      $setOnInsert: {
        tenantId: params.tenantId,
        createdAt: now
      }
    },
    { upsert: true }
  )

  await params.db.collection('tenantSubscriptions').updateMany(
    { tenantId: params.tenantId },
    {
      $set: {
        externalCustomerId: created.id,
        paymentProvider: params.provider,
        updatedAt: now
      }
    }
  )

  return { externalCustomerId: created.id }
}

/**
 * Start checkout for the current subscription period (Pay now).
 * Active provider: Stripe (default) or Razorpay when BILLING_PROVIDER=razorpay.
 */
export async function startCheckoutSession(params: {
  db: Db
  tenantId: ObjectIdType
  actorUserId: ObjectIdType
}): Promise<
  | { ok: true; session: CheckoutSessionResult }
  | { ok: false; error: string; message: string }
> {
  const provider = getActiveBillingProvider()

  if (provider === 'stripe' && !isStripeConfigured()) {
    return {
      ok: false,
      error: 'stripe_not_configured',
      message: 'Online payments are not configured yet. Add Stripe keys or use offline payment.'
    }
  }

  if (provider === 'razorpay' && !isRazorpayConfigured()) {
    return {
      ok: false,
      error: 'razorpay_not_configured',
      message: 'Online payments are not configured yet. Contact support or use offline payment.'
    }
  }

  const sub = await params.db.collection('tenantSubscriptions').findOne(
    {
      tenantId: params.tenantId,
      status: { $in: ['trialing', 'active', 'past_due', 'expired', 'incomplete'] }
    },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No subscription found' }
  }

  const plan = await params.db.collection('subscriptionPlans').findOne({ _id: sub.planId })

  if (!plan) {
    return { ok: false, error: 'plan_not_found', message: 'Subscription plan not found' }
  }

  const tenant = await params.db.collection('tenants').findOne({ _id: params.tenantId })

  if (!tenant) {
    return { ok: false, error: 'tenant_not_found', message: 'Organisation not found' }
  }

  const contact = await resolveBillingContact(params.db, sub as any)
  const customerName =
    (typeof (tenant as any).legalName === 'string' && (tenant as any).legalName) ||
    String(tenant.name || 'Customer')

  const { externalCustomerId } = await ensureBillingCustomer({
    db: params.db,
    tenantId: params.tenantId,
    name: customerName,
    email: (tenant as any).billingEmail || contact.email,
    contact: (tenant as any).billingPhone || contact.contact,
    provider
  })

  const interval = (sub.billingInterval || 'monthly') as 'monthly' | 'yearly'
  const now = new Date()
  const periodStart =
    sub.currentPeriodStart instanceof Date ? sub.currentPeriodStart : new Date(sub.currentPeriodStart)
  const periodEnd =
    sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd)

  const discountForInvoice = await ensureEligibleDiscountOnSubscription({
    db: params.db,
    tenantId: params.tenantId,
    subscription: sub,
    plan: plan as any
  })

  const invoice = await createSubscriptionInvoice({
    db: params.db,
    tenantId: params.tenantId,
    subscriptionId: sub._id as ObjectIdType,
    plan: plan as any,
    billingInterval: interval,
    periodStart: Number.isFinite(periodStart.getTime()) ? periodStart : now,
    periodEnd: Number.isFinite(periodEnd.getTime()) ? periodEnd : now,
    provider,
    discountSnapshot: discountForInvoice.snapshot || (sub as any).discountSnapshot || null,
    billingContactEmail: (tenant as any).billingEmail || contact.email,
    status: 'open'
  })

  const metadata = {
    tenantId: String(params.tenantId),
    subscriptionId: String(sub._id),
    invoiceId: invoice._id,
    invoiceNumber: invoice.invoiceNumber
  }

  const email = (tenant as any).billingEmail || contact.email
  const phone = (tenant as any).billingPhone || contact.contact
  const description = `Subscription — ${invoice.invoiceNumber}`

  if (provider === 'stripe') {
    const base = appBaseUrl()
    const checkout = await createStripeCheckoutPaymentSession({
      customerId: externalCustomerId,
      amountMinor: invoice.totalPaise,
      currency: invoice.currency,
      productName: `${plan.name || 'Subscription'} (${interval})`,
      description,
      successUrl: `${base}/admin/subscription?checkout=success&invoiceId=${encodeURIComponent(invoice._id)}`,
      cancelUrl: `${base}/admin/subscription?checkout=cancelled`,
      metadata,
      customerEmail: email
    })

    if (!checkout.url) {
      return { ok: false, error: 'checkout_url_missing', message: 'Stripe did not return a checkout URL' }
    }

    await params.db.collection('invoices').updateOne(
      { _id: new ObjectId(invoice._id) },
      { $set: { externalOrderId: checkout.id, updatedAt: new Date() } }
    )

    await params.db.collection('tenantSubscriptions').updateOne(
      { _id: sub._id },
      {
        $set: {
          paymentProvider: 'stripe',
          externalCustomerId,
          lastPaymentStatus: 'pending',
          updatedAt: new Date()
        }
      }
    )

    return {
      ok: true,
      session: {
        provider: 'stripe',
        checkoutUrl: checkout.url,
        sessionId: checkout.id,
        publishableKey: getStripePublishableKey(),
        amountPaise: invoice.totalPaise,
        currency: invoice.currency,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,
        customerName,
        customerEmail: email,
        customerContact: phone,
        description,
        subscriptionId: String(sub._id),
        notes: metadata
      }
    }
  }

  // --- Razorpay path (kept for later when Indian account is ready) ---
  const order = await createRazorpayOrder({
    amountPaise: invoice.totalPaise,
    currency: invoice.currency,
    receipt: invoice.invoiceNumber.replace(/\//g, '-').slice(0, 40),
    customerId: externalCustomerId,
    notes: metadata
  })

  await params.db.collection('invoices').updateOne(
    { _id: new ObjectId(invoice._id) },
    { $set: { externalOrderId: order.id, updatedAt: new Date() } }
  )

  await params.db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        paymentProvider: 'razorpay',
        externalCustomerId,
        lastPaymentStatus: 'pending',
        updatedAt: new Date()
      }
    }
  )

  return {
    ok: true,
    session: {
      provider: 'razorpay',
      keyId: getRazorpayKeyId(),
      orderId: order.id,
      amountPaise: invoice.totalPaise,
      currency: invoice.currency,
      invoiceId: invoice._id,
      invoiceNumber: invoice.invoiceNumber,
      customerName,
      customerEmail: email,
      customerContact: phone,
      description,
      subscriptionId: String(sub._id),
      prefill: {
        name: customerName,
        email,
        contact: phone
      },
      notes: metadata
    }
  }
}

/**
 * Start autopay (Stripe Subscriptions Checkout, or Razorpay Subscriptions when enabled).
 */
export async function startAutopaySubscription(params: {
  db: Db
  tenantId: ObjectIdType
}): Promise<
  | {
      ok: true
      provider: 'stripe' | 'razorpay'
      subscriptionId: string
      checkoutUrl?: string
      externalSubscriptionId?: string
      customerId: string
    }
  | { ok: false; error: string; message: string }
> {
  const provider = getActiveBillingProvider()

  if (provider === 'stripe' && !isStripeConfigured()) {
    return {
      ok: false,
      error: 'stripe_not_configured',
      message: 'Online payments are not configured yet.'
    }
  }

  if (provider === 'razorpay' && !isRazorpayConfigured()) {
    return {
      ok: false,
      error: 'razorpay_not_configured',
      message: 'Online payments are not configured yet.'
    }
  }

  const sub = await params.db.collection('tenantSubscriptions').findOne(
    { tenantId: params.tenantId, status: { $in: ['trialing', 'active', 'past_due', 'incomplete'] } },
    { sort: { updatedAt: -1 } }
  )

  if (!sub) {
    return { ok: false, error: 'no_subscription', message: 'No subscription found' }
  }

  const plan = await params.db.collection('subscriptionPlans').findOne({ _id: sub.planId })

  if (!plan) {
    return { ok: false, error: 'plan_not_found', message: 'Plan not found' }
  }

  const tenant = await params.db.collection('tenants').findOne({ _id: params.tenantId })

  if (!tenant) {
    return { ok: false, error: 'tenant_not_found', message: 'Organisation not found' }
  }

  const contact = await resolveBillingContact(params.db, sub as any)
  const customerName =
    (typeof (tenant as any).legalName === 'string' && (tenant as any).legalName) ||
    String(tenant.name || 'Customer')

  const { externalCustomerId } = await ensureBillingCustomer({
    db: params.db,
    tenantId: params.tenantId,
    name: customerName,
    email: (tenant as any).billingEmail || contact.email,
    contact: (tenant as any).billingPhone || contact.contact,
    provider
  })

  const interval = (sub.billingInterval || 'monthly') as 'monthly' | 'yearly'
  const amountPaise = planAmountPaise(plan as any, interval)
  const metadata = {
    tenantId: String(params.tenantId),
    subscriptionId: String(sub._id),
    planId: String(plan._id)
  }

  const discountForInvoice = await ensureEligibleDiscountOnSubscription({
    db: params.db,
    tenantId: params.tenantId,
    subscription: sub,
    plan: plan as any
  })
  const discountSnapshot = discountForInvoice.snapshot || (sub as any).discountSnapshot || null

  if (provider === 'stripe') {
    // Charge plan + GST for recurring: create a preview invoice total for first period pricing
    const now = new Date()
    const periodEnd = new Date(now.getTime() + (interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000)
    const invoice = await createSubscriptionInvoice({
      db: params.db,
      tenantId: params.tenantId,
      subscriptionId: sub._id as ObjectIdType,
      plan: plan as any,
      billingInterval: interval,
      periodStart: now,
      periodEnd,
      provider: 'stripe',
      discountSnapshot,
      billingContactEmail: (tenant as any).billingEmail || contact.email,
      status: 'open'
    })

    const base = appBaseUrl()
    const checkout = await createStripeCheckoutSubscriptionSession({
      customerId: externalCustomerId,
      amountMinor: invoice.totalPaise,
      currency: invoice.currency,
      productName: `${plan.name || 'Subscription'} (${interval})`,
      interval: interval === 'yearly' ? 'year' : 'month',
      successUrl: `${base}/admin/subscription?checkout=success&autopay=1&invoiceId=${encodeURIComponent(invoice._id)}`,
      cancelUrl: `${base}/admin/subscription?checkout=cancelled`,
      metadata: {
        ...metadata,
        invoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber
      }
    })

    if (!checkout.url) {
      return { ok: false, error: 'checkout_url_missing', message: 'Stripe did not return a checkout URL' }
    }

    await params.db.collection('invoices').updateOne(
      { _id: new ObjectId(invoice._id) },
      { $set: { externalOrderId: checkout.id, updatedAt: new Date() } }
    )

    await params.db.collection('tenantSubscriptions').updateOne(
      { _id: sub._id },
      {
        $set: {
          renewalMode: 'auto',
          paymentProvider: 'stripe',
          externalCustomerId,
          lastPaymentStatus: 'pending',
          updatedAt: new Date()
        }
      }
    )

    return {
      ok: true,
      provider: 'stripe',
      subscriptionId: String(sub._id),
      checkoutUrl: checkout.url,
      customerId: externalCustomerId
    }
  }

  // --- Razorpay autopay (dormant until BILLING_PROVIDER=razorpay) ---
  const existingPlanId =
    interval === 'yearly' ? (plan as any).razorpayPlanIdYearly : (plan as any).razorpayPlanIdMonthly

  const razorpayPlanId = await ensureRazorpayPlan({
    name: String(plan.name || 'Plan'),
    amountPaise,
    period: interval,
    currency: String((plan as any).currency || 'INR'),
    existingPlanId: typeof existingPlanId === 'string' ? existingPlanId : null
  })

  if (!existingPlanId) {
    const field = interval === 'yearly' ? 'razorpayPlanIdYearly' : 'razorpayPlanIdMonthly'

    await params.db.collection('subscriptionPlans').updateOne(
      { _id: plan._id },
      { $set: { [field]: razorpayPlanId, updatedAt: new Date() } }
    )
  }

  const rzSub = await createRazorpaySubscription({
    planId: razorpayPlanId,
    customerId: externalCustomerId,
    totalCount: interval === 'yearly' ? 10 : 120,
    notes: metadata
  })

  await params.db.collection('tenantSubscriptions').updateOne(
    { _id: sub._id },
    {
      $set: {
        renewalMode: 'auto',
        paymentProvider: 'razorpay',
        externalCustomerId,
        externalSubscriptionId: rzSub.id,
        externalPlanId: razorpayPlanId,
        externalSubscriptionStatus: rzSub.status,
        lastPaymentStatus: 'pending',
        updatedAt: new Date()
      }
    }
  )

  return {
    ok: true,
    provider: 'razorpay',
    subscriptionId: String(sub._id),
    externalSubscriptionId: rzSub.id,
    customerId: externalCustomerId
  }
}
