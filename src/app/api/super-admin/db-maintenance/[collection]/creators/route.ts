export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  isAllowedDbMaintenanceCollection,
  listDbMaintenanceCreators
} from '@/features/db-maintenance/services/dbMaintenanceAdmin.server'

export async function GET(request: Request, ctx: { params: Promise<{ collection: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const p = await ctx.params
  const collection = p?.collection

  if (!isAllowedDbMaintenanceCollection(collection)) {
    return NextResponse.json({ error: 'invalid_collection' }, { status: 400 })
  }

  const tenantId = (new URL(request.url).searchParams.get('tenantId') || '').trim()

  if (!tenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })

  try {
    const creators = await listDbMaintenanceCreators({ collection, tenantId })

    return NextResponse.json({ creators })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 400

    return NextResponse.json({ error: e?.message || 'failed' }, { status })
  }
}
