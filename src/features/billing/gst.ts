import type { GstBreakdown, TaxType } from './billing.types'

/** Default SAC for IT design and development services / SaaS. */
export const DEFAULT_SAC = '998314'

/** 18% GST in basis points. */
export const DEFAULT_GST_RATE_BPS = 1800

/**
 * Split GST for India: same state → CGST+SGST; different → IGST.
 * Amounts are integer paise; tax is rounded half-up per component.
 */
export function computeGst(params: {
  taxablePaise: number
  sellerStateCode: string | null | undefined
  buyerStateCode: string | null | undefined
  taxRateBps?: number
}): GstBreakdown {
  const taxablePaise = Math.max(0, Math.round(params.taxablePaise))
  const taxRateBps = params.taxRateBps ?? DEFAULT_GST_RATE_BPS
  const seller = (params.sellerStateCode || '').trim()
  const buyer = (params.buyerStateCode || '').trim()
  const taxType: TaxType = seller && buyer && seller === buyer ? 'intra' : 'inter'

  const totalTaxPaise = Math.round((taxablePaise * taxRateBps) / 10000)

  if (taxType === 'intra') {
    const half = Math.floor(totalTaxPaise / 2)
    const cgstPaise = half
    const sgstPaise = totalTaxPaise - half

    return {
      taxType,
      taxRateBps,
      taxablePaise,
      cgstPaise,
      sgstPaise,
      igstPaise: 0,
      totalTaxPaise,
      totalPaise: taxablePaise + totalTaxPaise
    }
  }

  return {
    taxType,
    taxRateBps,
    taxablePaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: totalTaxPaise,
    totalTaxPaise,
    totalPaise: taxablePaise + totalTaxPaise
  }
}

/** Convert rupees (float display price) to integer paise. */
export function rupeesToPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0

  return Math.round(rupees * 100)
}

export function paiseToRupees(paise: number): number {
  return Math.round(paise) / 100
}

export function formatPaiseInr(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(paiseToRupees(paise))
}
