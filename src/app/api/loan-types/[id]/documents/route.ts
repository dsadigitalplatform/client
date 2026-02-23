export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const STATUS_VALUES = ['REQUIRED', 'OPTIONAL', 'INACTIVE'] as const

type StatusValue = (typeof STATUS_VALUES)[number]

function isStatus(v: unknown): v is StatusValue {
  return typeof v === 'string' && STATUS_VALUES.includes(v as StatusValue)
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
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
  const loanTypeId = new ObjectId(id)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const loanType = await db
    .collection('loanTypes')
    .findOne({ _id: loanTypeId, tenantId: tenantIdObj }, { projection: { name: 1, description: 1, isActive: 1 } })

  if (!loanType) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const documentsRaw = await db
    .collection('documentChecklists')
    .find({ tenantId: tenantIdObj }, { projection: { name: 1, description: 1, isActive: 1 } })
    .sort({ name: 1 })
    .toArray()

  const mappingsRaw = await db
    .collection('loanTypeDocuments')
    .find({ tenantId: tenantIdObj, loanTypeId }, { projection: { documentId: 1, status: 1 } })
    .toArray()

  const documents = documentsRaw.map(d => ({
    id: String((d as any)._id),
    name: String((d as any).name || ''),
    description: (d as any).description ?? null,
    isActive: Boolean((d as any).isActive)
  }))

  const mappings = mappingsRaw.map(m => ({
    documentId: String((m as any).documentId),
    status: String((m as any).status || 'REQUIRED') as StatusValue
  }))

  return NextResponse.json({
    loanType: {
      id: String((loanType as any)._id),
      name: String((loanType as any).name || ''),
      description: (loanType as any).description ?? null,
      isActive: Boolean((loanType as any).isActive)
    },
    documents,
    mappings
  })
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
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
  const loanTypeId = new ObjectId(id)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const loanType = await db
    .collection('loanTypes')
    .findOne({ _id: loanTypeId, tenantId: tenantIdObj }, { projection: { _id: 1 } })

  if (!loanType) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))
  const mappingsInput = Array.isArray(body?.mappings) ? body.mappings : null

  if (!mappingsInput) return NextResponse.json({ error: 'invalid_mappings' }, { status: 400 })

  const errors: Record<string, string> = {}

  const uniqueDocs = new Set<string>()

  const sanitized = mappingsInput
    .map((m: any, idx: number) => {
      const docId = m?.documentId
      const status = m?.status

      if (!docId || !ObjectId.isValid(docId)) {
        errors[`mappings.${idx}.documentId`] = 'Invalid documentId'

        return null
      }

      if (!isStatus(status)) {
        errors[`mappings.${idx}.status`] = 'Invalid status'

        return null
      }

      if (uniqueDocs.has(docId)) {
        errors[`mappings.${idx}.documentId`] = 'Duplicate documentId'

        return null
      }

      uniqueDocs.add(docId)

      return { documentId: new ObjectId(docId), status }
    })
    .filter(Boolean) as Array<{ documentId: ObjectId; status: StatusValue }>

  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  if (sanitized.length > 0) {
    const ids = sanitized.map(s => s.documentId)

    const docs = await db
      .collection('documentChecklists')
      .find({ tenantId: tenantIdObj, _id: { $in: ids } }, { projection: { _id: 1 } })
      .toArray()

    if (docs.length !== ids.length) return NextResponse.json({ error: 'invalid_document' }, { status: 400 })
  }

  const now = new Date()

  await db.collection('loanTypeDocuments').deleteMany({ tenantId: tenantIdObj, loanTypeId })

  if (sanitized.length > 0) {
    const rows = sanitized.map(s => ({
      tenantId: tenantIdObj,
      loanTypeId,
      documentId: s.documentId,
      status: s.status,
      createdAt: now,
      updatedAt: now
    }))

    await db.collection('loanTypeDocuments').insertMany(rows)
  }

  return NextResponse.json({ ok: true })
}
