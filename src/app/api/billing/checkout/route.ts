export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

/**
 * Online checkout is temporarily disabled.
 * Owners choose a plan and use the trial; Super Admin marks payment received to activate.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'payments_disabled',
      message:
        'Online Pay now is temporarily unavailable. Choose a plan to use during trial; Super Admin will mark payment received to activate your subscription.'
    },
    { status: 403 }
  )
}
