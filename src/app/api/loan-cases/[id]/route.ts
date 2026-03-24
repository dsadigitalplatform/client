export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { upsertCaseFollowUpReminder } from '@features/reminders/services/remindersServer'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const DOCUMENT_STATUS_VALUES = ['COLLECTED', 'SUBMITTED_TO_BANK', 'APPROVED', 'PENDING'] as const
const LEAD_SOURCE_VALUES = ['DIRECT', 'ASSOCIATE'] as const

type DocumentStatus = (typeof DOCUMENT_STATUS_VALUES)[number]
type LeadSource = (typeof LEAD_SOURCE_VALUES)[number]

function isDocumentStatus(v: unknown): v is DocumentStatus {
  return typeof v === 'string' && (DOCUMENT_STATUS_VALUES as readonly string[]).includes(v)
}

function isLeadSource(v: unknown): v is LeadSource {
  return typeof v === 'string' && (LEAD_SOURCE_VALUES as readonly string[]).includes(v)
}

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

async function getTenantContext(session: any) {
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String(session?.currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

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

  const associate = (row as any).associateId
    ? await db
        .collection('associates')
        .findOne({ _id: (row as any).associateId, tenantId: tenantIdObj }, { projection: { associateName: 1, code: 1 } })
    : null

  const leadSource: LeadSource = isLeadSource((row as any).leadSource) ? (row as any).leadSource : 'DIRECT'

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
    leadSource,
    associateId: (row as any).associateId ? String((row as any).associateId) : null,
    associateName: associate ? String((associate as any).associateName || '') : null,
    associateCode: associate ? String((associate as any).code || '') : null,
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
    isActive: (row as any).isActive !== false,
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
  const incomingLeadSource = body.leadSource !== undefined ? String(body.leadSource) : undefined
  const incomingAssociateId = body.associateId !== undefined ? (body.associateId == null ? null : String(body.associateId)) : undefined

  if (body.nextFollowUpDate !== undefined) {
    const d = body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null

    if (!d || Number.isNaN(d.getTime())) errors.nextFollowUpDate = 'Invalid nextFollowUpDate'
    else patch.nextFollowUpDate = d
  }

  if (body.expectedActionDate !== undefined) {
    const d = body.expectedActionDate ? new Date(body.expectedActionDate) : null

    if (!d || Number.isNaN(d.getTime())) errors.expectedActionDate = 'Invalid expectedActionDate'
    else patch.expectedActionDate = d
  }

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

  if (incomingLeadSource !== undefined) {
    if (!isLeadSource(incomingLeadSource)) errors.leadSource = 'Invalid lead source'
    else patch.leadSource = incomingLeadSource
  }

  const nextLeadSource: LeadSource = isLeadSource(patch.leadSource)
    ? (patch.leadSource as LeadSource)
    : isLeadSource((existing as any).leadSource)
      ? ((existing as any).leadSource as LeadSource)
      : 'DIRECT'

  if (incomingAssociateId !== undefined || incomingLeadSource !== undefined) {
    if (nextLeadSource === 'ASSOCIATE') {
      const nextAssociateId = incomingAssociateId ?? ((existing as any).associateId ? String((existing as any).associateId) : null)

      if (!nextAssociateId) {
        errors.associateId = 'Associate is required'
      } else if (!ObjectId.isValid(nextAssociateId)) {
        errors.associateId = 'Invalid associate'
      } else {
        const associateObjId = new ObjectId(nextAssociateId)

        const associate = await db
          .collection('associates')
          .findOne({ _id: associateObjId, tenantId: tenantIdObj, isActive: true }, { projection: { _id: 1 } })

        if (!associate) errors.associateId = 'Associate must be active'
        else patch.associateId = associateObjId
      }
    } else {
      patch.associateId = null
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

  if (patch.nextFollowUpDate !== undefined || patch.expectedActionDate !== undefined || patch.assignedAgentId !== undefined) {
    const priorAssigned: ObjectId | null = (existing as any).assignedAgentId ?? null
    const nextAssigned: ObjectId | null = patch.assignedAgentId === undefined ? priorAssigned : patch.assignedAgentId
    const reminderUserId: ObjectId = (nextAssigned ?? (existing as any).createdBy) as ObjectId

    const nextFollowUp: Date | null = patch.nextFollowUpDate === undefined ? ((existing as any).nextFollowUpDate ?? null) : patch.nextFollowUpDate

    const nextExpected: Date | null =
      patch.expectedActionDate === undefined ? ((existing as any).expectedActionDate ?? null) : patch.expectedActionDate

    const reminderDateTime = nextFollowUp ?? nextExpected

    if (priorAssigned && nextAssigned && !priorAssigned.equals(nextAssigned)) {
      await db.collection('reminders').deleteMany({
        tenantId: tenantIdObj,
        source: 'CASE_FOLLOW_UP',
        status: 'pending',
        caseId: new ObjectId(id),
        userId: priorAssigned
      })
    }

    if (!reminderDateTime) {
      await db.collection('reminders').deleteMany({
        tenantId: tenantIdObj,
        source: 'CASE_FOLLOW_UP',
        status: 'pending',
        caseId: new ObjectId(id)
      })
    } else {
      try {
        await upsertCaseFollowUpReminder({
          db,
          tenantId: tenantIdObj,
          caseId: new ObjectId(id),
          userId: reminderUserId,
          customerId: ((existing as any).customerId ?? null) as ObjectId | null,
          reminderDateTime,
          caseNumber: body?.caseNumber
        })
      } catch (e: any) {
        console.error('reminder_upsert_failed', {
          err: e?.message || String(e),
          tenantId: tenantIdObj.toHexString(),
          caseId: id
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as any)

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx

  // Check if user has permission to delete (admin/owner or creator/assigned agent)
  const existing = await db.collection('loanCases').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!canAccessCase(role, userId, existing)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  // Soft delete: set isActive to false instead of actually deleting
  await db.collection('loanCases').updateOne(
    { _id: new ObjectId(id), tenantId: tenantIdObj },
    { 
      $set: { 
        isActive: false,
        updatedAt: new Date()
      } 
    }
  )

  return NextResponse.json({ ok: true, message: 'Case deleted successfully' })
}
