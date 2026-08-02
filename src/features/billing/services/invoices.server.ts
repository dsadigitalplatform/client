import 'server-only'

import type { Db, ObjectId as ObjectIdType } from 'mongodb'
import { ObjectId } from 'mongodb'

import type {
  BillingAddress,
  BillingInvoice,
  BillingProvider,
  InvoiceLineItem,
  PartySnapshot
} from '../billing.types'
import { computeGst, rupeesToPaise } from '../gst'
import { getSellerBillingConfig, sellerPartySnapshot } from '../sellerConfig'
import { allocateInvoiceNumber } from './invoiceNumber.server'

function toIso(d: unknown): string | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(String(d))

  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function asAddress(raw: unknown): BillingAddress | null {
  if (!raw || typeof raw !== 'object') return null
  const a = raw as Record<string, unknown>
  const line1 = typeof a.line1 === 'string' ? a.line1.trim() : ''

  if (!line1) return null

  return {
    line1,
    line2: typeof a.line2 === 'string' && a.line2.trim() ? a.line2.trim() : null,
    city: typeof a.city === 'string' ? a.city : '',
    state: typeof a.state === 'string' ? a.state : '',
    stateCode: typeof a.stateCode === 'string' ? a.stateCode : '',
    pincode: typeof a.pincode === 'string' ? a.pincode : '',
    country: typeof a.country === 'string' ? a.country : 'IN'
  }
}

export function serializeInvoice(doc: Record<string, any>): BillingInvoice {
  return {
    _id: String(doc._id),
    tenantId: String(doc.tenantId),
    subscriptionId: doc.subscriptionId ? String(doc.subscriptionId) : null,
    invoiceNumber: String(doc.invoiceNumber),
    fiscalYear: String(doc.fiscalYear),
    status: doc.status,
    currency: String(doc.currency || 'INR'),
    subtotalPaise: Number(doc.subtotalPaise) || 0,
    discountPaise: Number(doc.discountPaise) || 0,
    taxablePaise: Number(doc.taxablePaise) || 0,
    cgstPaise: Number(doc.cgstPaise) || 0,
    sgstPaise: Number(doc.sgstPaise) || 0,
    igstPaise: Number(doc.igstPaise) || 0,
    totalPaise: Number(doc.totalPaise) || 0,
    taxRateBps: Number(doc.taxRateBps) || 0,
    taxType: doc.taxType === 'intra' ? 'intra' : 'inter',
    sellerSnapshot: doc.sellerSnapshot as PartySnapshot,
    buyerSnapshot: doc.buyerSnapshot as PartySnapshot,
    lineItems: Array.isArray(doc.lineItems) ? (doc.lineItems as InvoiceLineItem[]) : [],
    discountSnapshot: (doc.discountSnapshot as Record<string, unknown>) || null,
    issuedAt: toIso(doc.issuedAt),
    dueAt: toIso(doc.dueAt),
    paidAt: toIso(doc.paidAt),
    voidedAt: toIso(doc.voidedAt),
    pdfUrl: typeof doc.pdfUrl === 'string' ? doc.pdfUrl : null,
    pdfStorageKey: typeof doc.pdfStorageKey === 'string' ? doc.pdfStorageKey : null,
    emailStatus: doc.emailStatus || 'pending',
    emailSentAt: toIso(doc.emailSentAt),
    emailError: typeof doc.emailError === 'string' ? doc.emailError : null,
    provider: doc.provider === 'manual' ? 'manual' : doc.provider === 'stripe' ? 'stripe' : 'razorpay',
    externalPaymentId: typeof doc.externalPaymentId === 'string' ? doc.externalPaymentId : null,
    externalOrderId: typeof doc.externalOrderId === 'string' ? doc.externalOrderId : null,
    irn: typeof doc.irn === 'string' ? doc.irn : null,
    createdAt: toIso(doc.createdAt) || new Date(0).toISOString(),
    updatedAt: toIso(doc.updatedAt) || new Date(0).toISOString()
  }
}

export function buildBuyerSnapshot(tenant: Record<string, any>, fallbackEmail?: string | null): PartySnapshot {
  const address = asAddress(tenant.billingAddress)
  const stateCode =
    (typeof tenant.placeOfSupplyStateCode === 'string' && tenant.placeOfSupplyStateCode) ||
    address?.stateCode ||
    null

  return {
    legalName:
      (typeof tenant.legalName === 'string' && tenant.legalName.trim()) ||
      (typeof tenant.name === 'string' && tenant.name) ||
      'Customer',
    gstin: typeof tenant.gstin === 'string' && tenant.gstin.trim() ? tenant.gstin.trim().toUpperCase() : null,
    pan: typeof tenant.pan === 'string' && tenant.pan.trim() ? tenant.pan.trim().toUpperCase() : null,
    email:
      (typeof tenant.billingEmail === 'string' && tenant.billingEmail.trim()) ||
      fallbackEmail ||
      null,
    phone: typeof tenant.billingPhone === 'string' && tenant.billingPhone.trim() ? tenant.billingPhone.trim() : null,
    address,
    stateCode,
    placeOfSupplyStateCode: stateCode
  }
}

export function planAmountPaise(plan: Record<string, any>, interval: 'monthly' | 'yearly'): number {
  if (interval === 'yearly') {
    if (typeof plan.priceYearlyPaise === 'number' && Number.isFinite(plan.priceYearlyPaise)) {
      return Math.round(plan.priceYearlyPaise)
    }

    if (typeof plan.priceYearly === 'number' && Number.isFinite(plan.priceYearly)) {
      return rupeesToPaise(plan.priceYearly)
    }

    // Fallback: 12× monthly
    return planAmountPaise(plan, 'monthly') * 12
  }

  if (typeof plan.priceMonthlyPaise === 'number' && Number.isFinite(plan.priceMonthlyPaise)) {
    return Math.round(plan.priceMonthlyPaise)
  }

  return rupeesToPaise(Number(plan.priceMonthly) || 0)
}

function applyDiscountPaise(
  subtotalPaise: number,
  discountSnapshot: Record<string, any> | null | undefined
): number {
  if (!discountSnapshot || typeof discountSnapshot !== 'object') return 0
  const type = discountSnapshot.type
  const value = Number(discountSnapshot.value)

  if (!Number.isFinite(value) || value <= 0) return 0

  if (type === 'percent') {
    return Math.min(subtotalPaise, Math.round((subtotalPaise * value) / 100))
  }

  if (type === 'fixed') {
    const currency = discountSnapshot.currency
    // Fixed discounts in catalog are rupees when currency is set
    const paise = currency ? rupeesToPaise(value) : Math.round(value)

    return Math.min(subtotalPaise, paise)
  }

  return 0
}

export type CreateSubscriptionInvoiceParams = {
  db: Db
  tenantId: ObjectIdType
  subscriptionId: ObjectIdType
  plan: Record<string, any>
  billingInterval: 'monthly' | 'yearly'
  periodStart: Date
  periodEnd: Date
  provider: BillingProvider
  discountSnapshot?: Record<string, any> | null
  billingContactEmail?: string | null
  status?: 'draft' | 'open'
  externalOrderId?: string | null
}

/**
 * Create an open/draft GST invoice for a subscription period.
 * Amounts are exclusive of GST (tax added on top of plan price).
 */
export async function createSubscriptionInvoice(
  params: CreateSubscriptionInvoiceParams
): Promise<BillingInvoice> {
  const {
    db,
    tenantId,
    subscriptionId,
    plan,
    billingInterval,
    periodStart,
    periodEnd,
    provider,
    discountSnapshot = null,
    billingContactEmail = null,
    status = 'open',
    externalOrderId = null
  } = params

  const now = new Date()
  const tenant = await db.collection('tenants').findOne({ _id: tenantId })

  if (!tenant) throw new Error('tenant_not_found')

  const sellerCfg = getSellerBillingConfig()
  const seller = sellerPartySnapshot(sellerCfg)
  const buyer = buildBuyerSnapshot(tenant as any, billingContactEmail)

  const subtotalPaise = planAmountPaise(plan, billingInterval)
  const discountPaise = applyDiscountPaise(subtotalPaise, discountSnapshot)
  const taxablePaise = Math.max(0, subtotalPaise - discountPaise)
  const gst = computeGst({
    taxablePaise,
    sellerStateCode: seller.stateCode,
    buyerStateCode: buyer.placeOfSupplyStateCode || buyer.stateCode,
    taxRateBps: sellerCfg.taxRateBps
  })

  const { invoiceNumber, fiscalYear } = await allocateInvoiceNumber(db, now)

  const intervalLabel = billingInterval === 'yearly' ? 'Annual' : 'Monthly'
  const lineItems: InvoiceLineItem[] = [
    {
      description: `${plan.name || 'Subscription'} — ${intervalLabel} subscription`,
      planId: plan._id ? String(plan._id) : null,
      billingInterval,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      quantity: 1,
      unitAmountPaise: subtotalPaise,
      amountPaise: subtotalPaise,
      hsnSac: sellerCfg.sac
    }
  ]

  const doc = {
    tenantId,
    subscriptionId,
    invoiceNumber,
    fiscalYear,
    status,
    currency: String(plan.currency || 'INR'),
    subtotalPaise,
    discountPaise,
    taxablePaise: gst.taxablePaise,
    cgstPaise: gst.cgstPaise,
    sgstPaise: gst.sgstPaise,
    igstPaise: gst.igstPaise,
    totalPaise: gst.totalPaise,
    taxRateBps: gst.taxRateBps,
    taxType: gst.taxType,
    sellerSnapshot: seller,
    buyerSnapshot: buyer,
    lineItems,
    discountSnapshot: discountSnapshot || null,
    issuedAt: now,
    dueAt: periodStart,
    paidAt: null,
    voidedAt: null,
    pdfUrl: null,
    pdfStorageKey: null,
    emailStatus: 'pending' as const,
    emailSentAt: null,
    emailError: null,
    provider,
    externalPaymentId: null,
    externalOrderId,
    irn: null,
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('invoices').insertOne(doc)

  return serializeInvoice({ ...doc, _id: res.insertedId })
}

export async function markInvoicePaid(params: {
  db: Db
  invoiceId: ObjectIdType
  paidAt?: Date
  externalPaymentId?: string | null
  externalOrderId?: string | null
}): Promise<BillingInvoice | null> {
  const now = params.paidAt || new Date()
  const $set: Record<string, unknown> = {
    status: 'paid',
    paidAt: now,
    updatedAt: now
  }

  if (params.externalPaymentId) $set.externalPaymentId = params.externalPaymentId
  if (params.externalOrderId) $set.externalOrderId = params.externalOrderId

  await params.db.collection('invoices').updateOne(
    { _id: params.invoiceId, status: { $in: ['draft', 'open'] } },
    { $set }
  )

  const doc = await params.db.collection('invoices').findOne({ _id: params.invoiceId })

  return doc ? serializeInvoice(doc as any) : null
}

export async function listTenantInvoices(
  db: Db,
  tenantId: ObjectIdType,
  limit = 50
): Promise<BillingInvoice[]> {
  const docs = await db
    .collection('invoices')
    .find({ tenantId })
    .sort({ issuedAt: -1, createdAt: -1 })
    .limit(Math.min(100, Math.max(1, limit)))
    .toArray()

  return docs.map(d => serializeInvoice(d as any))
}

export async function getTenantInvoice(
  db: Db,
  tenantId: ObjectIdType,
  invoiceId: string
): Promise<BillingInvoice | null> {
  if (!ObjectId.isValid(invoiceId)) return null
  const doc = await db.collection('invoices').findOne({
    _id: new ObjectId(invoiceId),
    tenantId
  })

  return doc ? serializeInvoice(doc as any) : null
}
