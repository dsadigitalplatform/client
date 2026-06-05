export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { isValidCountryCode } from '@/lib/countryCodes'
import { getDb } from '@/lib/mongodb'

function isValidEmail(v: unknown) {
  return typeof v === 'string' && /^.+@.+\..+$/.test(v)
}

function isValidMobile(v: unknown) {
  return typeof v === 'string' && /^[0-9]{8,10}$/.test(v)
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
  const row = await db.collection('advocates').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const createdByRaw = (row as any).createdBy

  const createdById =
    createdByRaw && typeof createdByRaw === 'object' && typeof createdByRaw.toHexString === 'function'
      ? createdByRaw.toHexString()
      : String(createdByRaw || '')

  const canManage = role === 'ADMIN' || role === 'OWNER' || createdById === userId.toHexString()

  const data = {
    id: String((row as any)._id),
    name: (row as any).name || '',
    countryCode: isValidCountryCode((row as any).countryCode) ? String((row as any).countryCode) : '+91',
    mobile: (row as any).mobile || '',
    email: (row as any).email ?? null,
    address: (row as any).address ?? null,
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

  if (body.name != null) patch.name = String(body.name).trim()
  if (body.countryCode !== undefined)
    patch.countryCode = body.countryCode == null || String(body.countryCode).trim().length === 0 ? '+91' : String(body.countryCode).trim()
  if (body.mobile != null) patch.mobile = String(body.mobile).trim()
  if (body.email !== undefined) patch.email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  if (body.address !== undefined) patch.address = body.address == null || String(body.address).trim().length === 0 ? null : String(body.address).trim()

  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}

  if (patch.name != null && patch.name.length < 2) errors.name = 'Name must be at least 2 characters'
  if (patch.countryCode != null && !isValidCountryCode(patch.countryCode)) errors.countryCode = 'Invalid country code'
  if (patch.mobile != null && !isValidMobile(patch.mobile)) errors.mobile = 'Mobile must be 8 to 10 digits'
  if (patch.email != null && !isValidEmail(patch.email)) errors.email = 'Invalid email format'
  if (patch.address != null && String(patch.address).length > 500) errors.address = 'Address must be ≤ 500 characters'

  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  try {
    const userScopedFilter =
      role === 'ADMIN' || role === 'OWNER'
        ? {}
        : { $or: [{ createdBy: userId }, { createdBy: userId.toHexString() }] }

    const res = await db
      .collection('advocates')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj, ...userScopedFilter }, { $set: patch })

    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_record', message: 'Advocate with this mobile already exists' }, { status: 409 })
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

  const res = await db.collection('advocates').deleteOne({ _id: new ObjectId(id), tenantId: tenantIdObj, ...userScopedFilter })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
