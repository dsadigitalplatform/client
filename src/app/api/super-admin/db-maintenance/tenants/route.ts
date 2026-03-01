export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { listDbMaintenanceTenants } from '@/features/db-maintenance/services/dbMaintenanceAdmin.server'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const tenants = await listDbMaintenanceTenants()

  return NextResponse.json({ tenants })
}

