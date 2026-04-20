export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  isAllowedDbMaintenanceCollection,
  listDbMaintenanceCreators
} from '@/features/db-maintenance/services/dbMaintenanceAdmin.server'

export async function GET(_request: Request, ctx: { params: Promise<{ collection: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const p = await ctx.params
  const collection = p?.collection

  if (!isAllowedDbMaintenanceCollection(collection)) {
    return NextResponse.json({ error: 'invalid_collection' }, { status: 400 })
  }

  const creators = await listDbMaintenanceCreators({ collection })

  return NextResponse.json({ creators })
}
