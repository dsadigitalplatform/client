export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { DUPLICATE_BANK_CODE_ERROR, findDuplicateBankCode, normalizeBankCode } from './_helpers'

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
  const userEmail = String((session as any)?.user?.email || '')

  const emailFilter =
    userEmail && userEmail.length > 0
      ? { email: { $regex: `^${userEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    baseFilter.$or = [
      { code: { $regex: safe, $options: 'i' } },
      { name: { $regex: safe, $options: 'i' } },
      { description: { $regex: safe, $options: 'i' } }
    ]
  }

  const rows = await db
    .collection('banks')
    .find(baseFilter, {
      projection: {
        code: 1,
        name: 1,
        description: 1,
        createdAt: 1
      }
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const banks = rows.map(r => ({
    id: String((r as any)._id),
    code: String((r as any).code || ''),
    name: String((r as any).name || ''),
    description: (r as any).description ? String((r as any).description) : null,
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null
  }))

  return NextResponse.json({ banks })
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
  const userEmail = String((session as any)?.user?.email || '')

  const emailFilter =
    userEmail && userEmail.length > 0
      ? { email: { $regex: `^${userEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const body = await request.json().catch(() => ({}))

  const code = String(body.code || '').trim()
  const name = String(body.name || '').trim()
  const description =
    body.description == null || String(body.description).trim().length === 0 ? null : String(body.description).trim()

  const errors: Record<string, string> = {}

  if (!isNonEmptyString(code)) errors.code = 'Code is required'
  if (!isNonEmptyString(name, 2)) errors.name = 'Bank name must be at least 2 characters'
  if (description != null && description.length > 500) errors.description = 'Description must be ≤ 500 characters'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const duplicate = await findDuplicateBankCode(db, tenantIdObj, code)

  if (duplicate) {
    return NextResponse.json(DUPLICATE_BANK_CODE_ERROR, { status: 409 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    code,
    codeNormalized: normalizeBankCode(code),
    name,
    description,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await db.collection('banks').insertOne(doc)

    return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json(DUPLICATE_BANK_CODE_ERROR, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
