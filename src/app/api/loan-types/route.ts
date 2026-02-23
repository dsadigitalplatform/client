export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown, min = 2) {
  return typeof v === 'string' && v.trim().length >= min
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

    baseFilter.$or = [{ name: { $regex: safe, $options: 'i' } }]
  }

  const rows = await db
    .collection('loanTypes')
    .aggregate([
      { $match: baseFilter },
      {
        $lookup: {
          from: 'loanTypeDocuments',
          let: { loanTypeId: '$_id', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$loanTypeId', '$$loanTypeId'] }, { $eq: ['$tenantId', '$$tenantId'] }]
                }
              }
            },
            { $count: 'count' }
          ],
          as: 'docCounts'
        }
      },
      {
        $addFields: {
          checklistCount: {
            $ifNull: [{ $arrayElemAt: ['$docCounts.count', 0] }, 0]
          }
        }
      },
      {
        $project: {
          name: 1,
          description: 1,
          isActive: 1,
          createdAt: 1,
          checklistCount: 1
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 200 }
    ])
    .toArray()

  const loanTypes = rows.map(r => ({
    id: String((r as any)._id),
    name: String((r as any).name || ''),
    description: (r as any).description ?? null,
    isActive: Boolean((r as any).isActive),
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null,
    checklistCount: Number((r as any).checklistCount || 0)
  }))

  return NextResponse.json({ loanTypes })
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

  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true

  const errors: Record<string, string> = {}

  if (!isNonEmptyString(name)) errors.name = 'Name is required'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  const safeName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

  const existing = await db
    .collection('loanTypes')
    .findOne({ tenantId: tenantIdObj, name: { $regex: `^${safeName}$`, $options: 'i' } }, { projection: { _id: 1 } })

  if (existing) {
    return NextResponse.json({ error: 'duplicate_name', message: 'Name already exists for this tenant' }, { status: 409 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    name,
    description,
    isActive,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await db.collection('loanTypes').insertOne(doc)

    return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_name', message: 'Name already exists for this tenant' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
