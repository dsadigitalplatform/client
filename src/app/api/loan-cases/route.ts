export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

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

async function buildChecklistForLoanType(db: any, tenantIdObj: ObjectId, loanTypeId: ObjectId) {
  const mappings = await db
    .collection('loanTypeDocuments')
    .find(
      { tenantId: tenantIdObj, loanTypeId, status: { $in: ['REQUIRED', 'OPTIONAL'] } },
      { projection: { documentId: 1 } }
    )
    .toArray()

  const docIds: ObjectId[] = mappings
    .map((m: any) => (m as any).documentId as ObjectId | undefined)
    .filter((id: ObjectId | undefined): id is ObjectId => Boolean(id))

  if (docIds.length === 0) return [] as Array<{ documentId: ObjectId; documentName: string; status: 'PENDING' }>

  const docs = await db
    .collection('documentChecklists')
    .find({ tenantId: tenantIdObj, _id: { $in: docIds } }, { projection: { name: 1 } })
    .toArray()

  const nameById = new Map<string, string>()

  docs.forEach((d: any) => nameById.set(String((d as any)._id), String((d as any).name || '')))

  const checklist = docIds
    .map((id: ObjectId) => ({ documentId: id, documentName: nameById.get(String(id)) || '' }))
    .filter((d: { documentId: ObjectId; documentName: string }) => d.documentName.length > 0)
    .sort((a: { documentName: string }, b: { documentName: string }) => a.documentName.localeCompare(b.documentName))
    .map((d: { documentId: ObjectId; documentName: string }) => ({ ...d, status: 'PENDING' as const }))

  return checklist
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx

  const url = new URL(request.url)
  const stageId = url.searchParams.get('stageId') || ''
  const assignedAgentId = url.searchParams.get('assignedAgentId') || ''
  const customerId = url.searchParams.get('customerId') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (stageId) {
    if (!ObjectId.isValid(stageId)) return NextResponse.json({ error: 'invalid_stageId' }, { status: 400 })
    baseFilter.stageId = new ObjectId(stageId)
  }

  if (assignedAgentId) {
    if (!ObjectId.isValid(assignedAgentId)) return NextResponse.json({ error: 'invalid_assignedAgentId' }, { status: 400 })
    baseFilter.assignedAgentId = new ObjectId(assignedAgentId)
  }

  if (customerId) {
    if (!ObjectId.isValid(customerId)) return NextResponse.json({ error: 'invalid_customerId' }, { status: 400 })
    baseFilter.customerId = new ObjectId(customerId)
  }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    baseFilter.$or = [{ createdBy: userId }, { assignedAgentId: userId }]
  }

  const rows = await db
    .collection('loanCases')
    .aggregate([
      { $match: baseFilter },
      { $sort: { updatedAt: -1 } },
      { $limit: 200 },
      {
        $lookup: {
          from: 'customers',
          let: { customerId: '$customerId', tenantId: '$tenantId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$customerId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
            { $project: { fullName: 1 } }
          ],
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'loanTypes',
          let: { loanTypeId: '$loanTypeId', tenantId: '$tenantId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$loanTypeId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
            { $project: { name: 1 } }
          ],
          as: 'loanType'
        }
      },
      { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'loanStatusPipelineStages',
          let: { stageId: '$stageId', tenantId: '$tenantId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$stageId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
            { $project: { name: 1, order: 1 } }
          ],
          as: 'stage'
        }
      },
      { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedAgentId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, email: 1 } }],
          as: 'assignedAgent'
        }
      },
      { $unwind: { path: '$assignedAgent', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          totalDocuments: { $size: { $ifNull: ['$documents', []] } },
          incompleteDocumentsCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$documents', []] },
                as: 'd',
                cond: { $ne: ['$$d.status', 'APPROVED'] }
              }
            }
          },
          pendingDocumentsCount: {
            $size: {
              $filter: {
                input: { $ifNull: ['$documents', []] },
                as: 'd',
                cond: { $eq: ['$$d.status', 'PENDING'] }
              }
            }
          }
        }
      },
      {
        $project: {
          _id: 1,
          customerId: 1,
          loanTypeId: 1,
          bankName: 1,
          requestedAmount: 1,
          stageId: 1,
          assignedAgentId: 1,
          updatedAt: 1,
          createdBy: 1,
          isLocked: 1,
          totalDocuments: 1,
          incompleteDocumentsCount: 1,
          pendingDocumentsCount: 1,
          customerName: '$customer.fullName',
          loanTypeName: '$loanType.name',
          stageName: '$stage.name',
          assignedAgentName: '$assignedAgent.name',
          assignedAgentEmail: '$assignedAgent.email'
        }
      }
    ])
    .toArray()

  const cases = rows.map(r => ({
    id: String((r as any)._id),
    customerId: String((r as any).customerId || ''),
    customerName: String((r as any).customerName || ''),
    loanTypeId: String((r as any).loanTypeId || ''),
    loanTypeName: String((r as any).loanTypeName || ''),
    bankName: (r as any).bankName ?? null,
    requestedAmount: (r as any).requestedAmount ?? null,
    stageId: String((r as any).stageId || ''),
    stageName: String((r as any).stageName || ''),
    assignedAgentId: (r as any).assignedAgentId ? String((r as any).assignedAgentId) : null,
    assignedAgentName: (r as any).assignedAgentName ?? null,
    assignedAgentEmail: (r as any).assignedAgentEmail ?? null,
    updatedAt: (r as any).updatedAt ? new Date((r as any).updatedAt).toISOString() : null,
    isLocked: Boolean((r as any).isLocked),
    totalDocuments: Number((r as any).totalDocuments || 0),
    incompleteDocumentsCount: Number((r as any).incompleteDocumentsCount || 0),
    pendingDocumentsCount: Number((r as any).pendingDocumentsCount || 0),
    hasIncompleteDocuments: Number((r as any).incompleteDocumentsCount || 0) > 0,
    canMoveStage:
      role === 'ADMIN' ||
      role === 'OWNER' ||
      (Boolean((r as any).createdBy) && (r as any).createdBy.equals(userId)) ||
      (Boolean((r as any).assignedAgentId) && (r as any).assignedAgentId.equals(userId))
  }))

  return NextResponse.json({ cases })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId } = ctx

  const body = await request.json().catch(() => ({}))
  const customerId = String(body?.customerId || '')
  const loanTypeId = String(body?.loanTypeId || '')
  const stageId = String(body?.stageId || '')
  const assignedAgentId = body?.assignedAgentId == null ? null : String(body.assignedAgentId)

  const bankName = body?.bankName == null || String(body.bankName).trim().length === 0 ? null : String(body.bankName).trim()
  const requestedAmount = body?.requestedAmount == null ? null : Number(body.requestedAmount)
  const eligibleAmount = body?.eligibleAmount == null ? null : Number(body.eligibleAmount)
  const interestRate = body?.interestRate == null ? null : Number(body.interestRate)
  const tenureMonths = body?.tenureMonths == null ? null : Number(body.tenureMonths)
  const emi = body?.emi == null ? null : Number(body.emi)

  const errors: Record<string, string> = {}

  if (!ObjectId.isValid(customerId)) errors.customerId = 'Customer is required'
  if (!ObjectId.isValid(loanTypeId)) errors.loanTypeId = 'Loan type is required'
  if (!ObjectId.isValid(stageId)) errors.stageId = 'Stage is required'

  if (!(typeof requestedAmount === 'number' && Number.isFinite(requestedAmount) && requestedAmount > 0))
    errors.requestedAmount = 'Loan amount must be greater than 0'
  if (emi != null && !(typeof emi === 'number' && Number.isFinite(emi))) errors.emi = 'EMI must be numeric'
  if (interestRate != null && !(typeof interestRate === 'number' && Number.isFinite(interestRate)))
    errors.interestRate = 'Interest rate must be numeric'
  if (tenureMonths != null && !(typeof tenureMonths === 'number' && Number.isFinite(tenureMonths) && tenureMonths >= 0))
    errors.tenureMonths = 'Tenure must be numeric'

  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  const tenantCustomer = await db
    .collection('customers')
    .findOne({ _id: new ObjectId(customerId), tenantId: tenantIdObj }, { projection: { _id: 1 } })

  if (!tenantCustomer) return NextResponse.json({ error: 'invalid_customer' }, { status: 400 })

  const tenantLoanType = await db
    .collection('loanTypes')
    .findOne({ _id: new ObjectId(loanTypeId), tenantId: tenantIdObj }, { projection: { _id: 1 } })

  if (!tenantLoanType) return NextResponse.json({ error: 'invalid_loanType' }, { status: 400 })

  const tenantStage = await db
    .collection('loanStatusPipelineStages')
    .findOne({ _id: new ObjectId(stageId), tenantId: tenantIdObj }, { projection: { _id: 1 } })

  if (!tenantStage) return NextResponse.json({ error: 'invalid_stage' }, { status: 400 })

  let assignedAgentObjId: ObjectId | null = null

  if (assignedAgentId != null) {
    if (!ObjectId.isValid(assignedAgentId)) return NextResponse.json({ error: 'invalid_assignedAgentId' }, { status: 400 })
    assignedAgentObjId = new ObjectId(assignedAgentId)

    const agentMembership = await db.collection('memberships').findOne(
      {
        tenantId: tenantIdObj,
        status: 'active',
        userId: assignedAgentObjId
      },
      { projection: { _id: 1 } }
    )

    if (!agentMembership) return NextResponse.json({ error: 'agent_not_in_tenant' }, { status: 400 })
  }

  const documents = await buildChecklistForLoanType(db, tenantIdObj, new ObjectId(loanTypeId))
  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    customerId: new ObjectId(customerId),
    loanTypeId: new ObjectId(loanTypeId),
    stageId: new ObjectId(stageId),
    bankName,
    requestedAmount,
    eligibleAmount,
    interestRate,
    tenureMonths,
    emi,
    assignedAgentId: assignedAgentObjId,
    documents,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    isLocked: true
  }

  const res = await db.collection('loanCases').insertOne(doc)

  return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
}
