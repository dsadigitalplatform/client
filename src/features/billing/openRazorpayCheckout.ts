'use client'

import type { CheckoutSessionResult } from '@features/billing/billing.types'

type RazorpaySuccessResponse = {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill?: { name?: string; email?: string | null; contact?: string | null }
  notes?: Record<string, string>
  handler: (response: RazorpaySuccessResponse) => void
  modal?: { ondismiss?: () => void }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

function loadRazorpayScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('window unavailable'))
  if (window.Razorpay) return Promise.resolve()

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay="checkout"]')

    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')))

      return
    }

    const script = document.createElement('script')

    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpay = 'checkout'
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'))
    document.body.appendChild(script)
  })
}

/**
 * Open Razorpay Checkout for an Order session, then confirm on our API.
 * Kept for when BILLING_PROVIDER=razorpay (India account).
 */
export async function openRazorpayCheckout(
  session: Extract<CheckoutSessionResult, { provider: 'razorpay' }>
): Promise<void> {
  await loadRazorpayScript()

  if (!window.Razorpay) throw new Error('Razorpay checkout unavailable')

  await new Promise<void>((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: session.keyId,
      amount: session.amountPaise,
      currency: session.currency,
      name: 'DSA Smart',
      description: session.description || `Invoice ${session.invoiceNumber}`,
      order_id: session.orderId,
      prefill: {
        name: session.prefill.name,
        email: session.prefill.email,
        contact: session.prefill.contact
      },
      notes: session.notes,
      handler: async response => {
        try {
          const res = await fetch('/api/billing/checkout/confirm', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              provider: 'razorpay',
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              invoiceId: session.invoiceId
            })
          })
          const json = await res.json()

          if (!res.ok) throw new Error(json?.message || json?.error || 'Payment confirmation failed')
          resolve()
        } catch (e) {
          reject(e)
        }
      },
      modal: {
        ondismiss: () => reject(new Error('Checkout cancelled'))
      }
    })

    rzp.open()
  })
}
