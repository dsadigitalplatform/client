export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isNonEmptyString(v: unknown, min = 2) {
  return typeof v === 'string' && v.trim().length >= min
}

const generateCodeFromName = (value: string) => {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9]+/g, ' ')
  const parts = cleaned.split(' ').filter(Boolean)

  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0].slice(0, 6).toUpperCase()

  return parts
    .map(p => p[0])
    .join('')
    .slice(0, 6)
    .toUpperCase()
}

const getUniqueCode = async (db: any, tenantId: ObjectId, base: string) => {
  const code = base.toUpperCase()

  if (!code) return ''

  const pattern = new RegExp(`^${code}(\\d+)?$`, 'i')

  const rows = await db
    .collection('loanTypes')
    .find({ tenantId, code: { $regex: pattern } }, { projection: { code: 1 } })
    .toArray()

  const used = new Set<string>(rows.map((r: any) => String((r as any).code || '').toUpperCase()))

  if (!used.has(code)) return code

  let max = 0

  used.forEach(c => {
    const match = c.match(new RegExp(`^${code}(\\d+)$`, 'i'))

    if (match?.[1]) {
      const n = Number(match[1])

      if (!Number.isNaN(n) && n > max) max = n
    }
  })

  return `${code}${max + 1}`
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
  const wantsSuggest = url.searchParams.get('suggestCode') === '1'
  const nameParam = url.searchParams.get('name') || ''

  if (wantsSuggest) {
    const base = generateCodeFromName(nameParam)
    const code = await getUniqueCode(db, tenantIdObj, base)

    return NextResponse.json({ code })
  }

  const q = url.searchParams.get('q') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    baseFilter.$or = [{ name: { $regex: safe, $options: 'i' } }, { code: { $regex: safe, $options: 'i' } }]
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
          code: 1,
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
    code: String((r as any).code || ''),
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

  const code = typeof body?.code === 'string' ? body.code.trim() : ''

  const name = typeof body?.name === 'string' ? body.name.trim() : ''

  const description =
    body?.description == null || String(body.description).trim().length === 0 ? null : String(body.description).trim()

  const isActive = typeof body?.isActive === 'boolean' ? body.isActive : true

  const errors: Record<string, string> = {}

  if (!isNonEmptyString(code)) errors.code = 'Code is required'
  if (!isNonEmptyString(name)) errors.name = 'Name is required'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    code,
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
      return NextResponse.json({ error: 'duplicate_code', message: 'Code already exists for this tenant' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
