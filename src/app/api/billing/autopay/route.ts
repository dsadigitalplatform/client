export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * Autopay is temporarily disabled.
 * Renewal stays manual until Super Admin marks payment received.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'payments_disabled',
      message:
        'Autopay is temporarily unavailable. Super Admin will mark payment received to activate or renew your subscription.'
    },
    { status: 403 }
  )
}
