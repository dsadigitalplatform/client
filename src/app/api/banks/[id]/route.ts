export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { DUPLICATE_BANK_CODE_ERROR, findDuplicateBankCode, normalizeBankCode } from '../_helpers'

function isNonEmptyString(v: unknown, min = 1) {
  return typeof v === 'string' && v.trim().length >= min
}

async function getRequestContext(session: any) {
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  if (!ObjectId.isValid(currentTenantId)) return { error: NextResponse.json({ error: 'invalid_tenant' }, { status: 400 }) }

  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const userId = new ObjectId(session.userId)
  const userEmail = String((session as any)?.user?.email || '')

  const emailFilter =
    userEmail && userEmail.length > 0
      ? { email: { $regex: `^${userEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    userId,
    role: String((membership as any).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const context = await getRequestContext(session as any)

  if ('error' in context) return context.error

  const { db, tenantIdObj, userId, role } = context
  const row = await db.collection('banks').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const createdByRaw = (row as any).createdBy

  const createdById =
    createdByRaw && typeof createdByRaw === 'object' && typeof createdByRaw.toHexString === 'function'
      ? createdByRaw.toHexString()
      : String(createdByRaw || '')

  const canManage = role === 'ADMIN' || role === 'OWNER' || createdById === userId.toHexString()

  const data = {
    id: String((row as any)._id),
    code: (row as any).code || '',
    name: (row as any).name || '',
    description: (row as any).description ?? null,
    canManage
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const context = await getRequestContext(session as any)

  if ('error' in context) return context.error

  const { db, tenantIdObj, userId, role } = context
  const body = await request.json().catch(() => ({}))

  const patch: any = {}

  if (body.code != null) patch.code = String(body.code).trim()
  if (body.name != null) patch.name = String(body.name).trim()
  if (body.description !== undefined)
    patch.description = body.description == null || String(body.description).trim().length === 0 ? null : String(body.description).trim()

  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}

  if (patch.code != null && !isNonEmptyString(patch.code)) errors.code = 'Code is required'
  if (patch.name != null && !isNonEmptyString(patch.name, 2)) errors.name = 'Bank name must be at least 2 characters'
  if (patch.description != null && String(patch.description).length > 500) errors.description = 'Description must be ≤ 500 characters'

  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  if (patch.code != null) {
    const duplicate = await findDuplicateBankCode(db, tenantIdObj, patch.code, new ObjectId(id))

    if (duplicate) {
      return NextResponse.json(DUPLICATE_BANK_CODE_ERROR, { status: 409 })
    }

    patch.codeNormalized = normalizeBankCode(patch.code)
  }

  try {
    const userScopedFilter =
      role === 'ADMIN' || role === 'OWNER'
        ? {}
        : { $or: [{ createdBy: userId }, { createdBy: userId.toHexString() }] }

    const res = await db
      .collection('banks')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj, ...userScopedFilter }, { $set: patch })

    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json(DUPLICATE_BANK_CODE_ERROR, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const context = await getRequestContext(session as any)

  if ('error' in context) return context.error

  const { db, tenantIdObj, userId, role } = context

  const userScopedFilter =
    role === 'ADMIN' || role === 'OWNER'
      ? {}
      : { $or: [{ createdBy: userId }, { createdBy: userId.toHexString() }] }

  const res = await db.collection('banks').deleteOne({ _id: new ObjectId(id), tenantId: tenantIdObj, ...userScopedFilter })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
