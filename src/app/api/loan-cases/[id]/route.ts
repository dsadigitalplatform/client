export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const DOCUMENT_STATUS_VALUES = ['COLLECTED', 'SUBMITTED_TO_BANK', 'APPROVED', 'PENDING'] as const

type DocumentStatus = (typeof DOCUMENT_STATUS_VALUES)[number]

function isDocumentStatus(v: unknown): v is DocumentStatus {
  return typeof v === 'string' && (DOCUMENT_STATUS_VALUES as readonly string[]).includes(v)
}

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

async function getTenantContext(session: any) {
  const currentTenantId = String(session?.currentTenantId || '')

  if (!currentTenantId) return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  if (!ObjectId.isValid(currentTenantId)) return { error: NextResponse.json({ error: 'invalid_tenant' }, { status: 400 }) }

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String(session?.user?.email || '')

  const emailFilter =
    email && email.length > 0 ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } } : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const tenantIdObj = new ObjectId(currentTenantId)

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

function canAccessCase(role: 'OWNER' | 'ADMIN' | 'USER', userId: ObjectId, row: any) {
  if (role === 'ADMIN' || role === 'OWNER') return true

  const createdBy = (row as any).createdBy as ObjectId | undefined
  const assignedAgentId = (row as any).assignedAgentId as ObjectId | undefined | null

  if (createdBy && createdBy.equals(userId)) return true
  if (assignedAgentId && assignedAgentId.equals(userId)) return true

  return false
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as any)

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx

  const row = await db.collection('loanCases').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canAccessCase(role, userId, row)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const customer = await db
    .collection('customers')
    .findOne({ _id: (row as any).customerId, tenantId: tenantIdObj }, { projection: { fullName: 1 } })

  const loanType = await db
    .collection('loanTypes')
    .findOne({ _id: (row as any).loanTypeId, tenantId: tenantIdObj }, { projection: { name: 1 } })

  const stage = await db
    .collection('loanStatusPipelineStages')
    .findOne({ _id: (row as any).stageId, tenantId: tenantIdObj }, { projection: { name: 1, order: 1 } })

  const assignedAgent = (row as any).assignedAgentId
    ? await db
        .collection('users')
        .findOne({ _id: (row as any).assignedAgentId }, { projection: { name: 1, email: 1 } })
    : null

  const data = {
    id: String((row as any)._id),
    customerId: String((row as any).customerId),
    customerName: customer ? String((customer as any).fullName || '') : '',
    loanTypeId: String((row as any).loanTypeId),
    loanTypeName: loanType ? String((loanType as any).name || '') : '',
    bankName: (row as any).bankName ?? null,
    requestedAmount: (row as any).requestedAmount ?? null,
    eligibleAmount: (row as any).eligibleAmount ?? null,
    interestRate: (row as any).interestRate ?? null,
    tenureMonths: (row as any).tenureMonths ?? null,
    emi: (row as any).emi ?? null,
    assignedAgentId: (row as any).assignedAgentId ? String((row as any).assignedAgentId) : null,
    assignedAgentName: assignedAgent ? String((assignedAgent as any).name || '') : null,
    assignedAgentEmail: assignedAgent ? ((assignedAgent as any).email ?? null) : null,
    stageId: String((row as any).stageId),
    stageName: stage ? String((stage as any).name || '') : '',
    documents: Array.isArray((row as any).documents)
      ? (row as any).documents.map((d: any) => ({
          documentId: String(d?.documentId || ''),
          documentName: String(d?.documentName || ''),
          status: String(d?.status || 'PENDING') as DocumentStatus
        }))
      : [],
    isLocked: Boolean((row as any).isLocked),
    updatedAt: (row as any).updatedAt ? new Date((row as any).updatedAt).toISOString() : null,
    createdAt: (row as any).createdAt ? new Date((row as any).createdAt).toISOString() : null
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as any)

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx

  const existing = await db.collection('loanCases').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canAccessCase(role, userId, existing)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const patch: any = {}
  const errors: Record<string, string> = {}

  if (body.customerId != null && String(body.customerId) !== String((existing as any).customerId)) {
    errors.customerId = 'Customer cannot be changed after first save'
  }

  if (body.loanTypeId != null && String(body.loanTypeId) !== String((existing as any).loanTypeId)) {
    errors.loanTypeId = 'Loan type cannot be changed after first save'
  }

  if (body.bankName !== undefined)
    patch.bankName = body.bankName == null || String(body.bankName).trim().length === 0 ? null : String(body.bankName).trim()

  if (body.requestedAmount !== undefined) patch.requestedAmount = body.requestedAmount == null ? null : Number(body.requestedAmount)
  if (body.eligibleAmount !== undefined) patch.eligibleAmount = body.eligibleAmount == null ? null : Number(body.eligibleAmount)
  if (body.interestRate !== undefined) patch.interestRate = body.interestRate == null ? null : Number(body.interestRate)
  if (body.tenureMonths !== undefined) patch.tenureMonths = body.tenureMonths == null ? null : Number(body.tenureMonths)
  if (body.emi !== undefined) patch.emi = body.emi == null ? null : Number(body.emi)

  if (body.stageId != null) {
    const stageId = String(body.stageId || '')

    if (!ObjectId.isValid(stageId)) {
      errors.stageId = 'Stage is required'
    } else {
      const found = await db
        .collection('loanStatusPipelineStages')
        .findOne({ _id: new ObjectId(stageId), tenantId: tenantIdObj }, { projection: { _id: 1 } })

      if (!found) errors.stageId = 'Invalid stage'
      else patch.stageId = new ObjectId(stageId)
    }
  }

  if (body.assignedAgentId !== undefined) {
    if (body.assignedAgentId == null || String(body.assignedAgentId).trim().length === 0) {
      patch.assignedAgentId = null
    } else {
      const assignedAgentId = String(body.assignedAgentId)

      if (!ObjectId.isValid(assignedAgentId)) {
        errors.assignedAgentId = 'Invalid assigned agent'
      } else {
        const agentIdObj = new ObjectId(assignedAgentId)

        const agentMembership = await db.collection('memberships').findOne(
          {
            tenantId: tenantIdObj,
            status: 'active',
            userId: agentIdObj
          },
          { projection: { _id: 1 } }
        )

        if (!agentMembership) errors.assignedAgentId = 'Assigned agent must belong to tenant'
        else patch.assignedAgentId = agentIdObj
      }
    }
  }

  if (patch.requestedAmount !== undefined) {
    const v = patch.requestedAmount

    if (!(typeof v === 'number' && Number.isFinite(v) && v > 0)) errors.requestedAmount = 'Loan amount must be greater than 0'
  }

  if (patch.emi !== undefined && patch.emi != null && !(typeof patch.emi === 'number' && Number.isFinite(patch.emi)))
    errors.emi = 'EMI must be numeric'

  if (
    patch.interestRate !== undefined &&
    patch.interestRate != null &&
    !(typeof patch.interestRate === 'number' && Number.isFinite(patch.interestRate))
  )
    errors.interestRate = 'Interest rate must be numeric'

  if (
    patch.tenureMonths !== undefined &&
    patch.tenureMonths != null &&
    !(typeof patch.tenureMonths === 'number' && Number.isFinite(patch.tenureMonths) && patch.tenureMonths >= 0)
  )
    errors.tenureMonths = 'Tenure must be numeric'

  if (body.documents !== undefined) {
    const incoming = Array.isArray(body.documents) ? body.documents : null

    if (!incoming) {
      errors.documents = 'Invalid documents payload'
    } else {
      const existingDocs = Array.isArray((existing as any).documents) ? ((existing as any).documents as any[]) : []
      const byId = new Map<string, any>()

      existingDocs.forEach(d => {
        if (d?.documentId) byId.set(String(d.documentId), d)
      })

      const nextDocs: any[] = []

      incoming.forEach((d: any, idx: number) => {
        const docId = String(d?.documentId || '')
        const status = d?.status

        if (!docId || !ObjectId.isValid(docId)) {
          errors[`documents.${idx}.documentId`] = 'Invalid documentId'

          return
        }

        if (!isDocumentStatus(status)) {
          errors[`documents.${idx}.status`] = 'Invalid status'

          return
        }

        const existingDoc = byId.get(docId)

        if (!existingDoc) {
          errors[`documents.${idx}.documentId`] = 'Document not part of checklist'

          return
        }

        nextDocs.push({
          documentId: new ObjectId(docId),
          documentName: String(existingDoc.documentName || ''),
          status
        })
      })

      if (Object.keys(errors).length === 0) patch.documents = nextDocs
    }
  }

  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  patch.isLocked = true
  patch.updatedAt = new Date()

  await db.collection('loanCases').updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: patch })

  return NextResponse.json({ ok: true })
}
