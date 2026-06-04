export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { ensureDemoMembership, isDemoLoginEnabled } from '@/lib/demoLogin'

export async function POST() {
  if (!isDemoLoginEnabled()) {
    return NextResponse.json({ error: 'demo_login_disabled' }, { status: 404 })
  }

  const session = await getServerSession(authOptions)

  if (!session?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const demoTenantId = await ensureDemoMembership(
      String(session.userId),
      String((session as any)?.user?.email || '')
    )

    return NextResponse.json({ success: true, demoTenantId })
  } catch (err: any) {
    const status = typeof err?.status === 'number' ? err.status : 500

    return NextResponse.json({ error: String(err?.message || 'demo_setup_failed') }, { status })
  }
}
