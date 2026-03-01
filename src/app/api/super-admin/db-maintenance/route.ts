export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  clearDbMaintenanceCollection,
  isAllowedDbMaintenanceCollection,
  listDbMaintenanceCollections
} from '@/features/db-maintenance/services/dbMaintenanceAdmin.server'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const collections = await listDbMaintenanceCollections()

  return NextResponse.json({ collections })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const collection = body?.collection

  if (!isAllowedDbMaintenanceCollection(collection)) {
    return NextResponse.json({ error: 'invalid_collection' }, { status: 400 })
  }

  const result = await clearDbMaintenanceCollection(collection)

  return NextResponse.json({ result })
}
