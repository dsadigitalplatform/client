import 'server-only'

import type { Db, ObjectId as ObjectIdType } from 'mongodb'
import { ObjectId } from 'mongodb'

import type { BillingPayment, BillingProvider, PaymentMethod, PaymentStatus } from '../billing.types'
import { formatPaiseInr } from '../gst'
import { sendMail } from '@/lib/mailer'

import { markInvoicePaid, serializeInvoice } from './invoices.server'
import { buildInvoiceHtml } from './invoiceHtml.server'

function toIso(d: unknown): string | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(String(d))

  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function serializePayment(doc: Record<string, any>): BillingPayment {
  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    subscriptionId: doc.subscriptionId ? String(doc.subscriptionId) : null,
    invoiceId: doc.invoiceId ? String(doc.invoiceId) : null,
    provider: doc.provider === 'manual' ? 'manual' : doc.provider === 'stripe' ? 'stripe' : 'razorpay',
    externalPaymentId: typeof doc.externalPaymentId === 'string' ? doc.externalPaymentId : null,
    externalOrderId: typeof doc.externalOrderId === 'string' ? doc.externalOrderId : null,
    externalInvoiceId: typeof doc.externalInvoiceId === 'string' ? doc.externalInvoiceId : null,
    amountPaise: Number(doc.amountPaise) || 0,
    currency: String(doc.currency || 'INR'),
    status: doc.status as PaymentStatus,
    method: (doc.method as PaymentMethod) || null,
    failureCode: typeof doc.failureCode === 'string' ? doc.failureCode : null,
    failureMessage: typeof doc.failureMessage === 'string' ? doc.failureMessage : null,
    recordedBy: doc.recordedBy ? String(doc.recordedBy) : null,
    note: typeof doc.note === 'string' ? doc.note : null,
    paidAt: toIso(doc.paidAt),
    createdAt: toIso(doc.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(doc.updatedAt) || new Date(0).toISOString()
  }
}

export async function createPaymentRecord(params: {
  db: Db
  tenantId: ObjectIdType
  subscriptionId?: ObjectIdType | null
  invoiceId?: ObjectIdType | null
  provider: BillingProvider
  amountPaise: number
  currency?: string
  status: PaymentStatus
  method?: string | null
  externalPaymentId?: string | null
  externalOrderId?: string | null
  externalInvoiceId?: string | null
  recordedBy?: ObjectIdType | null
  note?: string | null
  paidAt?: Date | null
  rawProviderPayload?: Record<string, unknown> | null
  failureCode?: string | null
  failureMessage?: string | null
}): Promise<BillingPayment> {
  const now = new Date()
  const doc = {
    tenantId: params.tenantId,
    subscriptionId: params.subscriptionId || null,
    invoiceId: params.invoiceId || null,
    provider: params.provider,
    externalPaymentId: params.externalPaymentId || null,
    externalOrderId: params.externalOrderId || null,
    externalInvoiceId: params.externalInvoiceId || null,
    amountPaise: Math.round(params.amountPaise),
    currency: params.currency || 'INR',
    status: params.status,
    method: params.method || null,
    failureCode: params.failureCode || null,
    failureMessage: params.failureMessage || null,
    recordedBy: params.recordedBy || null,
    note: params.note || null,
    rawProviderPayload: params.rawProviderPayload || null,
    paidAt: params.paidAt || (params.status === 'captured' ? now : null),
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await params.db.collection('payments').insertOne(doc)

    return serializePayment({ ...doc, _id: res.insertedId })
  } catch (err: any) {
    // Idempotent on duplicate Razorpay payment id
    if (err?.code === 11000 && params.externalPaymentId) {
      const existing = await params.db.collection('payments').findOne({
        externalPaymentId: params.externalPaymentId
      })

      if (existing) return serializePayment(existing as any)
    }

    throw err
  }
}

function periodLengthDays(interval: 'monthly' | 'yearly') {
  return interval === 'yearly' ? 365 : 30
}

function nextPeriodBounds(from: Date, interval: 'monthly' | 'yearly') {
  const days = periodLengthDays(interval)
  const start = from
  const end = new Date(from.getTime() + days * 24 * 60 * 60 * 1000)

  return { start, end }
}

/**
 * After a successful payment: mark invoice paid, roll subscription period, email invoice.
 */
export async function finalizeSuccessfulPayment(params: {
  db: Db
  tenantId: ObjectIdType
  subscriptionId: ObjectIdType
  invoiceId: ObjectIdType
  provider: BillingProvider
  amountPaise: number
  method?: string | null
  externalPaymentId?: string | null
  externalOrderId?: string | null
  recordedBy?: ObjectIdType | null
  note?: string | null
  rawProviderPayload?: Record<string, unknown> | null
  /** When true, do not roll the period (e.g. already rolled by caller). Default rolls. */
  skipPeriodRoll?: boolean
}): Promise<{ payment: BillingPayment; invoice: ReturnType<typeof serializeInvoice> | null }> {
  const now = new Date()
  const payment = await createPaymentRecord({
    db: params.db,
    tenantId: params.tenantId,
    subscriptionId: params.subscriptionId,
    invoiceId: params.invoiceId,
    provider: params.provider,
    amountPaise: params.amountPaise,
    status: 'captured',
    method: params.method,
    externalPaymentId: params.externalPaymentId,
    externalOrderId: params.externalOrderId,
    recordedBy: params.recordedBy,
    note: params.note,
    paidAt: now,
    rawProviderPayload: params.rawProviderPayload
  })

  const invoice = await markInvoicePaid({
    db: params.db,
    invoiceId: params.invoiceId,
    paidAt: now,
    externalPaymentId: params.externalPaymentId,
    externalOrderId: params.externalOrderId
  })

  if (!params.skipPeriodRoll) {
    const sub = await params.db.collection('tenantSubscriptions').findOne({ _id: params.subscriptionId })

    if (sub) {
      const interval = (sub.billingInterval || 'monthly') as 'monthly' | 'yearly'
      const periodEnd =
        sub.currentPeriodEnd instanceof Date ? sub.currentPeriodEnd : new Date(sub.currentPeriodEnd)
      const rollFrom =
        Number.isFinite(periodEnd.getTime()) && periodEnd.getTime() > now.getTime() ? periodEnd : now
      const bounds = nextPeriodBounds(rollFrom, interval)

      await params.db.collection('tenantSubscriptions').updateOne(
        { _id: params.subscriptionId },
        {
          $set: {
            status: 'active',
            trialStartsAt: null,
            trialEndsAt: null,
            currentPeriodStart: bounds.start,
            currentPeriodEnd: bounds.end,
            cancelAtPeriodEnd: false,
            canceledAt: null,
            paymentProvider: params.provider,
            lastPaymentStatus: 'succeeded',
            lastPaymentMethod: params.method || null,
            lastPaymentNote: params.note || null,
            lastPaymentAt: now,
            lastPaymentRecordedBy: params.recordedBy || null,
            updatedAt: now
          }
        }
      )
    }
  } else {
    await params.db.collection('tenantSubscriptions').updateOne(
      { _id: params.subscriptionId },
      {
        $set: {
          status: 'active',
          paymentProvider: params.provider,
          lastPaymentStatus: 'succeeded',
          lastPaymentMethod: params.method || null,
          lastPaymentNote: params.note || null,
          lastPaymentAt: now,
          lastPaymentRecordedBy: params.recordedBy || null,
          updatedAt: now
        }
      }
    )
  }

  // Email invoice (best-effort)
  if (invoice) {
    try {
      await emailInvoice({ db: params.db, invoiceId: params.invoiceId })
    } catch (e: any) {
      await params.db.collection('invoices').updateOne(
        { _id: params.invoiceId },
        {
          $set: {
            emailStatus: 'failed',
            emailError: String(e?.message || e).slice(0, 500),
            updatedAt: new Date()
          }
        }
      )
    }
  }

  return { payment, invoice }
}

export async function emailInvoice(params: {
  db: Db
  invoiceId: ObjectIdType
}): Promise<{ sent: boolean; to: string | null; cc: string | null }> {
  const doc = await params.db.collection('invoices').findOne({ _id: params.invoiceId })

  if (!doc) return { sent: false, to: null, cc: null }

  const invoice = serializeInvoice(doc as any)
  const tenantId = new ObjectId(invoice.tenantId)
  const billingContactEmail = await resolveBillingContactEmail(params.db, tenantId)
  const gstBillingEmail = await resolveTenantGstBillingEmail(params.db, tenantId, invoice.buyerSnapshot?.email)

  // Billing contact receives the invoice; GST billing email is CC'd when different.
  const to = billingContactEmail || gstBillingEmail
  const cc =
    gstBillingEmail && to && normalizeEmail(gstBillingEmail) !== normalizeEmail(to) ? gstBillingEmail : null

  if (!to) {
    await params.db.collection('invoices').updateOne(
      { _id: params.invoiceId },
      {
        $set: {
          emailStatus: 'skipped',
          emailError: 'No billing contact or GST billing email on file',
          updatedAt: new Date()
        }
      }
    )

    return { sent: false, to: null, cc: null }
  }

  const html = buildInvoiceHtml(invoice)
  const subject = `Tax Invoice ${invoice.invoiceNumber} — ${formatPaiseInr(invoice.totalPaise)}`

  await sendMail({
    to,
    ...(cc ? { cc } : {}),
    subject,
    html,
    text: `Tax Invoice ${invoice.invoiceNumber}. Total: ${formatPaiseInr(invoice.totalPaise)}. Status: ${invoice.status}.`
  })

  await params.db.collection('invoices').updateOne(
    { _id: params.invoiceId },
    {
      $set: {
        emailStatus: 'sent',
        emailSentAt: new Date(),
        emailError: null,
        emailTo: to,
        emailCc: cc,
        updatedAt: new Date()
      }
    }
  )

  return { sent: true, to, cc }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

async function resolveTenantGstBillingEmail(
  db: Db,
  tenantId: ObjectIdType,
  buyerSnapshotEmail?: string | null
): Promise<string | null> {
  if (typeof buyerSnapshotEmail === 'string' && buyerSnapshotEmail.trim()) {
    return buyerSnapshotEmail.trim()
  }

  const tenant = await db.collection('tenants').findOne({ _id: tenantId }, { projection: { billingEmail: 1 } })
  const email = typeof tenant?.billingEmail === 'string' ? tenant.billingEmail.trim() : ''

  return email || null
}

async function resolveBillingContactEmail(db: Db, tenantId: ObjectIdType): Promise<string | null> {
  const sub = await db.collection('tenantSubscriptions').findOne(
    { tenantId },
    { sort: { updatedAt: -1 }, projection: { billingContactUserId: 1 } }
  )

  if (!sub?.billingContactUserId) return null
  const user = await db.collection('users').findOne(
    { _id: sub.billingContactUserId },
    { projection: { email: 1 } }
  )

  return typeof user?.email === 'string' && user.email.trim() ? user.email.trim() : null
}
