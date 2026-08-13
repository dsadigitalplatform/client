import type { BillingInvoice } from '../billing.types'
import { formatPaiseInr } from '../gst'

function esc(s: string | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)

  if (Number.isNaN(d.getTime())) return '—'

  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatAddress(inv: BillingInvoice['sellerSnapshot']): string {
  const a = inv.address

  if (!a) return ''
  const parts = [a.line1, a.line2, a.city, a.state, a.pincode, a.country].filter(Boolean)

  return parts.map(esc).join(', ')
}

/** Printable GST tax invoice HTML (emailed + downloadable). */
export function buildInvoiceHtml(invoice: BillingInvoice): string {
  const seller = invoice.sellerSnapshot
  const buyer = invoice.buyerSnapshot
  const taxRows =
    invoice.taxType === 'intra'
      ? `<tr><td>CGST (${(invoice.taxRateBps / 200).toFixed(1)}%)</td><td style="text-align:right">${esc(formatPaiseInr(invoice.cgstPaise))}</td></tr>
         <tr><td>SGST (${(invoice.taxRateBps / 200).toFixed(1)}%)</td><td style="text-align:right">${esc(formatPaiseInr(invoice.sgstPaise))}</td></tr>`
      : `<tr><td>IGST (${(invoice.taxRateBps / 100).toFixed(1)}%)</td><td style="text-align:right">${esc(formatPaiseInr(invoice.igstPaise))}</td></tr>`

  const lines = invoice.lineItems
    .map(
      li => `<tr>
      <td>${esc(li.description)}<br/><span style="color:#666;font-size:12px">SAC: ${esc(li.hsnSac)}${
        li.periodStart
          ? ` · ${esc(formatDate(li.periodStart))} – ${esc(formatDate(li.periodEnd))}`
          : ''
      }</span></td>
      <td style="text-align:center">${li.quantity}</td>
      <td style="text-align:right">${esc(formatPaiseInr(li.unitAmountPaise))}</td>
      <td style="text-align:right">${esc(formatPaiseInr(li.amountPaise))}</td>
    </tr>`
    )
    .join('')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${esc(invoice.invoiceNumber)}</title>
  <style>
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 14px; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .muted { color: #666; }
    .grid { display: flex; gap: 24px; margin: 20px 0; }
    .col { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px; vertical-align: top; }
    th { text-align: left; background: #f7f7f7; }
    .totals { width: 320px; margin-left: auto; }
    .totals td { border: none; padding: 4px 8px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; background: #e8f5e9; color: #1b5e20; font-size: 12px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <h1>Tax Invoice</h1>
      <div class="muted">Invoice no. <strong>${esc(invoice.invoiceNumber)}</strong></div>
      <div class="muted">Date: ${esc(formatDate(invoice.issuedAt || invoice.createdAt))}</div>
      <div class="muted">FY: ${esc(invoice.fiscalYear)}</div>
    </div>
    <div style="text-align:right">
      <span class="badge">${esc(invoice.status)}</span>
      <div style="margin-top:8px"><strong>${esc(seller.legalName)}</strong></div>
      ${seller.gstin ? `<div class="muted">GSTIN: ${esc(seller.gstin)}</div>` : ''}
      <div class="muted">${formatAddress(seller)}</div>
    </div>
  </div>

  <div class="grid">
    <div class="col">
      <strong>Bill To</strong>
      <div>${esc(buyer.legalName)}</div>
      ${buyer.gstin ? `<div class="muted">GSTIN: ${esc(buyer.gstin)}</div>` : '<div class="muted">GSTIN: Unregistered</div>'}
      ${buyer.pan ? `<div class="muted">PAN: ${esc(buyer.pan)}</div>` : ''}
      ${buyer.address ? `<div class="muted">${formatAddress(buyer)}</div>` : ''}
      ${buyer.email ? `<div class="muted">${esc(buyer.email)}</div>` : ''}
    </div>
    <div class="col">
      <strong>Supply</strong>
      <div class="muted">Place of supply: ${esc(buyer.placeOfSupplyStateCode || buyer.stateCode || '—')}</div>
      <div class="muted">Tax: ${invoice.taxType === 'intra' ? 'CGST + SGST' : 'IGST'}</div>
      <div class="muted">Currency: ${esc(invoice.currency)}</div>
      ${invoice.externalPaymentId ? `<div class="muted">Payment ref: ${esc(invoice.externalPaymentId)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th style="text-align:center">Qty</th>
        <th style="text-align:right">Rate</th>
        <th style="text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>

  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right">${esc(formatPaiseInr(invoice.subtotalPaise))}</td></tr>
    ${
      invoice.discountPaise > 0
        ? `<tr><td>Discount</td><td style="text-align:right">−${esc(formatPaiseInr(invoice.discountPaise))}</td></tr>`
        : ''
    }
    <tr><td>Taxable value</td><td style="text-align:right">${esc(formatPaiseInr(invoice.taxablePaise))}</td></tr>
    ${taxRows}
    <tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${esc(formatPaiseInr(invoice.totalPaise))}</strong></td></tr>
  </table>

  <p class="muted" style="margin-top:32px;font-size:12px">
    This is a computer-generated tax invoice for SaaS subscription services.
    ${seller.email ? `For billing queries contact ${esc(seller.email)}.` : ''}
  </p>
</body>
</html>`
}
