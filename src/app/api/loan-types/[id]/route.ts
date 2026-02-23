export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown, min = 2) {
  return typeof v === 'string' && v.trim().length >= min
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const row = await db.collection('loanTypes').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const data = {
    id: String((row as any)._id),
    code: String((row as any).code || ''),
    name: String((row as any).name || ''),
    description: (row as any).description ?? null,
    isActive: Boolean((row as any).isActive),
    createdAt: (row as any).createdAt ? new Date((row as any).createdAt).toISOString() : null
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const body = await request.json().catch(() => ({}))

  const patch: any = {}

  if (body.code != null) patch.code = String(body.code).trim()
  if (body.name != null) patch.name = String(body.name).trim()
  if (body.description !== undefined)
    patch.description = body.description == null || String(body.description).trim().length === 0 ? null : String(body.description).trim()
  if (typeof body?.isActive === 'boolean') patch.isActive = body.isActive
  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}

  if (patch.code != null && !isNonEmptyString(patch.code)) errors.code = 'Code is required'
  if (patch.name != null && !isNonEmptyString(patch.name)) errors.name = 'Name is required'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  try {
    const res = await db
      .collection('loanTypes')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: patch })

    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_code', message: 'Code already exists for this tenant' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const loanTypeId = new ObjectId(id)

  const res = await db.collection('loanTypes').deleteOne({ _id: loanTypeId, tenantId: tenantIdObj })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  await db.collection('loanTypeDocuments').deleteMany({ tenantId: tenantIdObj, loanTypeId })

  return NextResponse.json({ ok: true })
}
