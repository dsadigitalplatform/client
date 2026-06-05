export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { DUPLICATE_CORPORATE_CODE_ERROR, findDuplicateCorporateCode, normalizeCorporateCode } from './_helpers'

function isNonEmptyString(v: unknown, min = 1) {
  return typeof v === 'string' && v.trim().length >= min
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  let role: 'OWNER' | 'ADMIN' | 'USER' = 'USER'

  if (!isSuperAdmin) {
    const membership = await db
      .collection('memberships')
      .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

    if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })
    role = String((membership as any).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    baseFilter.$or = [{ name: { $regex: safe, $options: 'i' } }, { code: { $regex: safe, $options: 'i' } }]
  }

  const rows = await db
    .collection('corporates')
    .find(baseFilter, {
      projection: {
        code: 1,
        name: 1,
        isActive: 1,
        createdBy: 1,
        createdAt: 1
      }
    })
    .sort({ name: 1 })
    .limit(200)
    .toArray()

  const corporates = rows.map(r => ({
    id: String((r as any)._id),
    code: String((r as any).code || ''),
    name: String((r as any).name || ''),
    isActive: Boolean((r as any).isActive),
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null,
    canManage:
      isSuperAdmin ||
      role === 'ADMIN' ||
      role === 'OWNER' ||
      String(
        (r as any).createdBy && typeof (r as any).createdBy.toHexString === 'function'
          ? (r as any).createdBy.toHexString()
          : (r as any).createdBy || ''
      ) === userId.toHexString()
  }))

  return NextResponse.json({ corporates })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  if (!isSuperAdmin) {
    const membership = await db
      .collection('memberships')
      .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

    if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true

  const errors: Record<string, string> = {}

  if (!isNonEmptyString(code)) errors.code = 'Code is required'
  if (!isNonEmptyString(name, 2)) errors.name = 'Name must be at least 2 characters'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  const duplicate = await findDuplicateCorporateCode(db, tenantIdObj, code)

  if (duplicate) {
    return NextResponse.json(DUPLICATE_CORPORATE_CODE_ERROR, { status: 409 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    code,
    codeNormalized: normalizeCorporateCode(code),
    name,
    isActive,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await db.collection('corporates').insertOne(doc)

    return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json(DUPLICATE_CORPORATE_CODE_ERROR, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
