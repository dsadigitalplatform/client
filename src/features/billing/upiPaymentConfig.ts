/**
 * Manual UPI settlement details shown on Subscription → Payment & activation.
 * Safe to expose in the client — this is the public payee identity for offline collection.
 * Override via NEXT_PUBLIC_BILLING_UPI_* env vars without a code change.
 */
export type UpiPaymentConfig = {
  payeeName: string
  vpa: string
  bankName: string
  qrImageSrc: string
  qrAlt: string
}

function env(name: string, fallback: string): string {
  const v = process.env[name]

  return typeof v === 'string' && v.trim() ? v.trim() : fallback
}

export function getUpiPaymentConfig(): UpiPaymentConfig {
  return {
    payeeName: env('NEXT_PUBLIC_BILLING_UPI_PAYEE_NAME', 'MANOKARAN CHIDAMBARAM'),
    vpa: env('NEXT_PUBLIC_BILLING_UPI_VPA', 'manokaran546@icici'),
    bankName: env('NEXT_PUBLIC_BILLING_UPI_BANK', 'ICICI Bank'),
    qrImageSrc: env('NEXT_PUBLIC_BILLING_UPI_QR_SRC', '/images/upi-pay-qr.png'),
    qrAlt: 'UPI QR code — scan to pay with any UPI app'
  }
}
