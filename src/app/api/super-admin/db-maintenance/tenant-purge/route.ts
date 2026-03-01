export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { purgeTenantData } from '@/features/db-maintenance/services/dbMaintenanceAdmin.server'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const tenantId = typeof body?.tenantId === 'string' ? body.tenantId : ''

  try {
    const result = await purgeTenantData(tenantId)

    return NextResponse.json({ result })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 400 })
  }
}
