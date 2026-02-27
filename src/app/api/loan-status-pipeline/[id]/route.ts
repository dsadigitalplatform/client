export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown, min = 2) {
  return typeof v === 'string' && v.trim().length >= min
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

async function isActiveMember(db: any, tenantIdObj: ObjectId, session: any) {
  const userId = new ObjectId(session.userId)
  const email = String(session?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  return Boolean(membership)
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

  if (!(await isActiveMember(db, tenantIdObj, session))) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const row = await db.collection('loanStatusPipelineStages').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const data = {
    id: String((row as any)._id),
    name: String((row as any).name || ''),
    description: (row as any).description ?? null,
    order: Number((row as any).order || 0),
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

  if (!(await isActiveMember(db, tenantIdObj, session))) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const body = await request.json().catch(() => ({}))

  const patch: any = {}

  if (body.name != null) patch.name = String(body.name).trim()
  if (body.description !== undefined)
    patch.description = body.description == null || String(body.description).trim().length === 0 ? null : String(body.description).trim()
  if (body.order !== undefined) patch.order = typeof body.order === 'number' ? body.order : Number(body.order)
  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}

  if (patch.name != null && !isNonEmptyString(patch.name)) errors.name = 'Stage name is required'
  if (patch.order !== undefined && !isPositiveInt(patch.order)) errors.order = 'Stage must be a whole number ≥ 1'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  try {
    if (patch.name != null) {
      const safeName = String(patch.name).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

      const existing = await db.collection('loanStatusPipelineStages').findOne(
        {
          tenantId: tenantIdObj,
          name: { $regex: `^${safeName}$`, $options: 'i' },
          _id: { $ne: new ObjectId(id) }
        },
        { projection: { _id: 1 } }
      )

      if (existing) {
        return NextResponse.json({ error: 'duplicate_name', message: 'Stage name already exists for this tenant' }, { status: 409 })
      }
    }

    const res = await db
      .collection('loanStatusPipelineStages')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: patch })

    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_name', message: 'Stage name already exists for this tenant' }, { status: 409 })
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
  const stageId = new ObjectId(id)

  if (!(await isActiveMember(db, tenantIdObj, session))) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const res = await db.collection('loanStatusPipelineStages').deleteOne({ _id: stageId, tenantId: tenantIdObj })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
