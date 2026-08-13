import type { BillingAddress, PartySnapshot } from './billing.types'
import { DEFAULT_GST_RATE_BPS, DEFAULT_SAC } from './gst'

export type SellerBillingConfig = {
  legalName: string
  gstin: string | null
  pan: string | null
  email: string | null
  phone: string | null
  address: BillingAddress
  stateCode: string
  sac: string
  taxRateBps: number
  invoicePrefix: string
  logoUrl: string | null
}

function env(name: string, fallback = ''): string {
  const v = process.env[name]

  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

/**
 * Platform seller details for GST invoices.
 * Configure via env; safe defaults for local/dev.
 */
export function getSellerBillingConfig(): SellerBillingConfig {
  const stateCode = env('BILLING_SELLER_STATE_CODE', '27')
  const taxRateRaw = Number(env('BILLING_GST_RATE_BPS', String(DEFAULT_GST_RATE_BPS)))
  const taxRateBps = Number.isFinite(taxRateRaw) && taxRateRaw >= 0 ? Math.round(taxRateRaw) : DEFAULT_GST_RATE_BPS

  return {
    legalName: env('BILLING_SELLER_LEGAL_NAME', 'DSA Smart'),
    gstin: env('BILLING_SELLER_GSTIN') || null,
    pan: env('BILLING_SELLER_PAN') || null,
    email: env('BILLING_SELLER_EMAIL') || env('SMTP_FROM') || null,
    phone: env('BILLING_SELLER_PHONE') || null,
    address: {
      line1: env('BILLING_SELLER_ADDRESS_LINE1', 'Registered Office'),
      line2: env('BILLING_SELLER_ADDRESS_LINE2') || null,
      city: env('BILLING_SELLER_CITY', 'Mumbai'),
      state: env('BILLING_SELLER_STATE', 'Maharashtra'),
      stateCode,
      pincode: env('BILLING_SELLER_PINCODE', '400001'),
      country: env('BILLING_SELLER_COUNTRY', 'IN')
    },
    stateCode,
    sac: env('BILLING_SAC', DEFAULT_SAC),
    taxRateBps,
    invoicePrefix: env('BILLING_INVOICE_PREFIX', 'DSA'),
    logoUrl: env('BILLING_LOGO_URL') || null
  }
}

export function sellerPartySnapshot(cfg = getSellerBillingConfig()): PartySnapshot {
  return {
    legalName: cfg.legalName,
    gstin: cfg.gstin,
    pan: cfg.pan,
    email: cfg.email,
    phone: cfg.phone,
    address: cfg.address,
    stateCode: cfg.stateCode
  }
}

export function indianFiscalYear(at: Date = new Date()): string {
  // Indian FY: 1 Apr → 31 Mar
  const year = at.getFullYear()
  const month = at.getMonth() // 0-based
  const startYear = month >= 3 ? year : year - 1
  const endYearShort = String(startYear + 1).slice(-2)

  return `${startYear}-${endYearShort}`
}
