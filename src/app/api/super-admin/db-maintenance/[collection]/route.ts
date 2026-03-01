export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import {
  deleteDbMaintenanceDocuments,
  isAllowedDbMaintenanceCollection,
  listDbMaintenanceDocuments
} from '@/features/db-maintenance/services/dbMaintenanceAdmin.server'

export async function GET(request: Request, ctx: { params: Promise<{ collection: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const p = await ctx.params
  const collection = p?.collection

  if (!isAllowedDbMaintenanceCollection(collection)) {
    return NextResponse.json({ error: 'invalid_collection' }, { status: 400 })
  }

  const url = new URL(request.url)
  const limitParam = url.searchParams.get('limit')
  const cursor = url.searchParams.get('cursor')
  const limit = limitParam ? Number(limitParam) : undefined

  const result = await listDbMaintenanceDocuments({ collection, limit, cursor })

  return NextResponse.json(result)
}

export async function POST(request: Request, ctx: { params: Promise<{ collection: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const p = await ctx.params
  const collection = p?.collection

  if (!isAllowedDbMaintenanceCollection(collection)) {
    return NextResponse.json({ error: 'invalid_collection' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body?.ids) ? body.ids.map((v: any) => String(v)) : []

  const result = await deleteDbMaintenanceDocuments({ collection, ids })

  return NextResponse.json(result)
}
