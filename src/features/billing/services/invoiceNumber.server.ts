import 'server-only'

import type { Db } from 'mongodb'

import { getSellerBillingConfig, indianFiscalYear } from '../sellerConfig'

/**
 * Atomically allocate the next invoice number for the current (or given) fiscal year.
 * Format: `{prefix}/{FY}/{seq padded 5}` e.g. DSA/2026-27/00042
 */
export async function allocateInvoiceNumber(
  db: Db,
  at: Date = new Date()
): Promise<{ invoiceNumber: string; fiscalYear: string; seq: number }> {
  const cfg = getSellerBillingConfig()
  const fiscalYear = indianFiscalYear(at)
  const prefix = cfg.invoicePrefix

  const result = await db.collection('invoiceCounters').findOneAndUpdate(
    { fiscalYear, prefix },
    {
      $inc: { seq: 1 },
      $setOnInsert: { fiscalYear, prefix }
    },
    { upsert: true, returnDocument: 'after' }
  )

  // Driver 6+ returns the document; older typings may wrap as { value }
  const doc = (result as any)?.value ?? result
  const seq = typeof doc?.seq === 'number' && Number.isFinite(doc.seq) ? Math.trunc(doc.seq) : 1
  const invoiceNumber = `${prefix}/${fiscalYear}/${String(seq).padStart(5, '0')}`

  return { invoiceNumber, fiscalYear, seq }
}
