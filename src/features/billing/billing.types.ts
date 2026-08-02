export type BillingProvider = 'stripe' | 'razorpay' | 'manual'

export type BillingAddress = {
  line1: string
  line2: string | null
  city: string
  state: string
  stateCode: string
  pincode: string
  country: string
}

export type PartySnapshot = {
  legalName: string
  gstin: string | null
  pan: string | null
  email: string | null
  phone: string | null
  address: BillingAddress | null
  stateCode: string | null
  placeOfSupplyStateCode?: string | null
}

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible'
export type TaxType = 'intra' | 'inter'
export type InvoiceEmailStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export type InvoiceLineItem = {
  description: string
  planId: string | null
  billingInterval: 'monthly' | 'yearly' | null
  periodStart: string | null
  periodEnd: string | null
  quantity: number
  unitAmountPaise: number
  amountPaise: number
  hsnSac: string
}

export type BillingInvoice = {
  _id: string
  tenantId: string
  subscriptionId: string | null
  invoiceNumber: string
  fiscalYear: string
  status: InvoiceStatus
  currency: string
  subtotalPaise: number
  discountPaise: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalPaise: number
  taxRateBps: number
  taxType: TaxType
  sellerSnapshot: PartySnapshot
  buyerSnapshot: PartySnapshot
  lineItems: InvoiceLineItem[]
  discountSnapshot: Record<string, unknown> | null
  issuedAt: string | null
  dueAt: string | null
  paidAt: string | null
  voidedAt: string | null
  pdfUrl: string | null
  pdfStorageKey: string | null
  emailStatus: InvoiceEmailStatus
  emailSentAt: string | null
  emailError: string | null
  provider: BillingProvider
  externalPaymentId: string | null
  externalOrderId: string | null
  irn: string | null
  createdAt: string
  updatedAt: string
}

export type PaymentStatus =
  | 'created'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partial_refund'

export type PaymentMethod =
  | 'upi'
  | 'card'
  | 'netbanking'
  | 'wallet'
  | 'emi'
  | 'cash'
  | 'bank_transfer'
  | 'cheque'
  | 'complimentary'
  | 'other'

export type BillingPayment = {
  _id: string
  tenantId: string
  subscriptionId: string | null
  invoiceId: string | null
  provider: BillingProvider
  externalPaymentId: string | null
  externalOrderId: string | null
  externalInvoiceId: string | null
  amountPaise: number
  currency: string
  status: PaymentStatus
  method: PaymentMethod | string | null
  failureCode: string | null
  failureMessage: string | null
  recordedBy: string | null
  note: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}

export type BillingCustomer = {
  _id: string
  tenantId: string
  provider: BillingProvider
  externalCustomerId: string | null
  email: string | null
  contact: string | null
  createdAt: string
  updatedAt: string
}

export type GstBreakdown = {
  taxType: TaxType
  taxRateBps: number
  taxablePaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  totalTaxPaise: number
  totalPaise: number
}

export type CheckoutSessionResult =
  | {
      provider: 'stripe'
      checkoutUrl: string
      sessionId: string
      publishableKey: string | null
      amountPaise: number
      currency: string
      invoiceId: string
      invoiceNumber: string
      customerName: string
      customerEmail: string | null
      customerContact: string | null
      description: string
      subscriptionId: string
      notes: Record<string, string>
    }
  | {
      provider: 'razorpay'
      keyId: string
      orderId: string
      amountPaise: number
      currency: string
      invoiceId: string
      invoiceNumber: string
      customerName: string
      customerEmail: string | null
      customerContact: string | null
      description: string
      subscriptionId: string
      prefill: {
        name: string
        email: string | null
        contact: string | null
      }
      notes: Record<string, string>
    }
