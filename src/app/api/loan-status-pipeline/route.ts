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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
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

    baseFilter.$or = [{ name: { $regex: safe, $options: 'i' } }, { description: { $regex: safe, $options: 'i' } }]
  }

  const rows = await db
    .collection('loanStatusPipelineStages')
    .find(baseFilter, {
      projection: {
        name: 1,
        description: 1,
        order: 1,
        createdAt: 1
      }
    })
    .sort({ order: 1, createdAt: 1 })
    .limit(200)
    .toArray()

  const stages = rows.map(r => ({
    id: String((r as any)._id),
    name: String((r as any).name || ''),
    description: (r as any).description ?? null,
    order: Number((r as any).order || 0),
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null
  }))

  return NextResponse.json({ stages })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const body = await request.json().catch(() => ({}))

  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  const description =
    body?.description == null || String(body.description).trim().length === 0 ? null : String(body.description).trim()

  const order = typeof body?.order === 'number' ? body.order : Number(body?.order)

  const errors: Record<string, string> = {}

  if (!isNonEmptyString(name)) errors.name = 'Stage name is required'
  if (!isPositiveInt(order)) errors.order = 'Stage must be a whole number ≥ 1'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  const safeName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  const existing = await db.collection('loanStatusPipelineStages').findOne(
    { tenantId: tenantIdObj, name: { $regex: `^${safeName}$`, $options: 'i' } },
    { projection: { _id: 1 } }
  )

  if (existing) {
    return NextResponse.json({ error: 'duplicate_name', message: 'Stage name already exists for this tenant' }, { status: 409 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    name,
    description,
    order,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await db.collection('loanStatusPipelineStages').insertOne(doc)

    return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_name', message: 'Stage name already exists for this tenant' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
