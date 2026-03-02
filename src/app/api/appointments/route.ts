export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { upsertAppointmentReminder } from '@features/reminders/services/remindersServer'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

type Role = 'OWNER' | 'ADMIN' | 'USER'

const FOLLOW_UP_TYPES = ['CALL', 'WHATSAPP', 'VISIT', 'EMAIL'] as const
const STATUS_VALUES = ['SCHEDULED', 'PENDING', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW'] as const

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

  return { db, tenantIdObj, userId, role: String((membership as any).role || 'USER') as Role }
}

async function ensureAssignedToInTenant(db: any, tenantIdObj: ObjectId, assignedToObjId: ObjectId) {
  const m = await db.collection('memberships').findOne(
    {
      tenantId: tenantIdObj,
      status: 'active',
      userId: assignedToObjId
    },
    { projection: { _id: 1 } }
  )

  return Boolean(m)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx
  const body = await request.json().catch(() => ({}))

  const leadId = String(body.leadId || '').trim()
  const customerId = String(body.customerId || '').trim()
  const followUpType = String(body.followUpType || '').toUpperCase().trim()
  const outcomeCommentsRaw = body?.outcomeComments

  const outcomeComments =
    outcomeCommentsRaw == null || String(outcomeCommentsRaw).trim().length === 0 ? null : String(outcomeCommentsRaw).trim()

  const scheduledAtRaw = body.scheduledAt
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null

  const durationMinutes =
    body.durationMinutes == null || Number.isNaN(Number(body.durationMinutes)) ? 30 : Number(body.durationMinutes)

  const assignedToRaw = body.assignedTo == null || String(body.assignedTo).trim().length === 0 ? null : String(body.assignedTo).trim()
  const caseIdRaw = body.caseId == null || String(body.caseId).trim().length === 0 ? null : String(body.caseId).trim()

  const errors: Record<string, string> = {}

  if (!ObjectId.isValid(leadId)) errors.leadId = 'Invalid leadId'
  if (!ObjectId.isValid(customerId)) errors.customerId = 'Invalid customerId'
  if (!FOLLOW_UP_TYPES.includes(followUpType as any)) errors.followUpType = 'Invalid followUpType'
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) errors.scheduledAt = 'Invalid scheduledAt'
  if (scheduledAt && scheduledAt.getTime() <= Date.now()) errors.scheduledAt = 'scheduledAt must be in the future'
  if (!(durationMinutes >= 1)) errors.durationMinutes = 'durationMinutes must be ≥ 1'

  if (caseIdRaw && !ObjectId.isValid(caseIdRaw)) errors.caseId = 'Invalid caseId'

  let assignedToObjId: ObjectId | null = null

  if (role !== 'ADMIN' && role !== 'OWNER') {
    assignedToObjId = userId
  } else if (assignedToRaw) {
    if (!ObjectId.isValid(assignedToRaw)) {
      errors.assignedTo = 'Invalid assignedTo'
    } else {
      assignedToObjId = new ObjectId(assignedToRaw)
      const ok = await ensureAssignedToInTenant(db, tenantIdObj, assignedToObjId)

      if (!ok) errors.assignedTo = 'assignedTo_not_in_tenant'
    }
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const leadIdObj = new ObjectId(leadId)
  const customerIdObj = new ObjectId(customerId)

  const [customer, lead] = await Promise.all([
    db.collection('customers').findOne({ _id: customerIdObj, tenantId: tenantIdObj }, { projection: { _id: 1, fullName: 1 } }),
    db
      .collection('loanCases')
      .findOne({ _id: leadIdObj, tenantId: tenantIdObj }, { projection: { _id: 1, customerId: 1 } })
  ])

  if (!customer) return NextResponse.json({ error: 'customer_not_found' }, { status: 404 })
  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })

  if (!((lead as any).customerId as ObjectId).equals(customerIdObj)) {
    return NextResponse.json({ error: 'lead_customer_mismatch' }, { status: 400 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    leadId: leadIdObj,
    customerId: customerIdObj,
    caseId: caseIdRaw ? new ObjectId(caseIdRaw) : null,
    scheduledAt: scheduledAt!,
    durationMinutes,
    followUpType,
    status: 'SCHEDULED',
    outcomeComments,
    assignedTo: assignedToObjId,
    createdBy: userId,
    parentAppointmentId: null,
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('appointments').insertOne(doc)

  if (!assignedToObjId) {
    console.warn('reminder_skipped_missing_assigned_user', {
      tenantId: tenantIdObj.toHexString(),
      appointmentId: res.insertedId.toHexString()
    })
  } else {
    try {
      await upsertAppointmentReminder({
        db,
        tenantId: tenantIdObj,
        appointmentId: res.insertedId,
        userId: assignedToObjId,
        caseId: caseIdRaw ? new ObjectId(caseIdRaw) : null,
        customerId: customerIdObj,
        customerName: (customer as any)?.fullName ? String((customer as any).fullName) : null,
        followUpType,
        notes: body?.notes,
        appointmentDateTime: scheduledAt
      })
    } catch (e: any) {
      console.error('reminder_upsert_failed', {
        err: e?.message || String(e),
        tenantId: tenantIdObj.toHexString(),
        appointmentId: res.insertedId.toHexString()
      })
    }
  }

  return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx

  const url = new URL(request.url)
  const leadId = url.searchParams.get('leadId') || ''
  const customerId = url.searchParams.get('customerId') || ''
  const assignedTo = url.searchParams.get('assignedTo') || ''
  const status = url.searchParams.get('status') || ''
  const dateFrom = url.searchParams.get('dateFrom') || ''
  const dateTo = url.searchParams.get('dateTo') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (leadId) {
    if (!ObjectId.isValid(leadId)) return NextResponse.json({ error: 'invalid_leadId' }, { status: 400 })
    baseFilter.leadId = new ObjectId(leadId)
  }

  if (customerId) {
    if (!ObjectId.isValid(customerId)) return NextResponse.json({ error: 'invalid_customerId' }, { status: 400 })
    baseFilter.customerId = new ObjectId(customerId)
  }

  if (assignedTo) {
    if (!ObjectId.isValid(assignedTo)) return NextResponse.json({ error: 'invalid_assignedTo' }, { status: 400 })
    baseFilter.assignedTo = new ObjectId(assignedTo)
  }

  if (status) {
    const s = String(status).toUpperCase()

    if (!STATUS_VALUES.includes(s as any)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
    if (s === 'PENDING') baseFilter.status = { $in: ['PENDING', 'SCHEDULED'] }
    else baseFilter.status = s
  }

  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom) : null
    const to = dateTo ? new Date(dateTo) : null

    if (from && Number.isNaN(from.getTime())) return NextResponse.json({ error: 'invalid_dateFrom' }, { status: 400 })
    if (to && Number.isNaN(to.getTime())) return NextResponse.json({ error: 'invalid_dateTo' }, { status: 400 })

    if (from && to && from.getTime() > to.getTime()) {
      return NextResponse.json({ error: 'invalid_date_range' }, { status: 400 })
    }

    baseFilter.scheduledAt = {}
    if (from) baseFilter.scheduledAt.$gte = from
    if (to) baseFilter.scheduledAt.$lte = to
  }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    baseFilter.assignedTo = userId
  }

  const rows = await db
    .collection('appointments')
    .aggregate([
      { $match: baseFilter },
      { $sort: { scheduledAt: 1 } },
      { $limit: 500 },
      {
        $lookup: {
          from: 'customers',
          let: { customerId: '$customerId', tenantId: '$tenantId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$customerId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
            { $project: { fullName: 1, mobile: 1, email: 1 } }
          ],
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'loanCases',
          let: { leadId: '$leadId', tenantId: '$tenantId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$leadId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
            { $project: { loanTypeId: 1, bankName: 1 } }
          ],
          as: 'lead'
        }
      },
      { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'loanTypes',
          let: { loanTypeId: '$lead.loanTypeId', tenantId: '$tenantId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$_id', '$$loanTypeId'] },
                    { $eq: ['$tenantId', '$$tenantId'] }
                  ]
                }
              }
            },
            { $project: { name: 1 } }
          ],
          as: 'loanType'
        }
      },
      { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, email: 1 } }],
          as: 'assignedAgent'
        }
      },
      { $unwind: { path: '$assignedAgent', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          leadId: 1,
          customerId: 1,
          caseId: 1,
          scheduledAt: 1,
          durationMinutes: 1,
          followUpType: 1,
          status: 1,
          outcomeComments: 1,
          outcomeHistory: 1,
          assignedTo: 1,
          createdBy: 1,
          parentAppointmentId: 1,
          createdAt: 1,
          updatedAt: 1,
          customerName: '$customer.fullName',
          leadLoanTypeName: '$loanType.name',
          leadBankName: '$lead.bankName',
          assignedAgentName: '$assignedAgent.name',
          assignedAgentEmail: '$assignedAgent.email'
        }
      }
    ])
    .toArray()

  const appointments = rows.map(r => {
    const loanTypeName = (r as any).leadLoanTypeName ? String((r as any).leadLoanTypeName) : null
    const bankName = (r as any).leadBankName != null ? String((r as any).leadBankName) : null
    const leadTitle = loanTypeName ? `${loanTypeName}${bankName ? ` • ${bankName}` : ''}` : null

    return {
      id: String((r as any)._id),
      leadId: (r as any).leadId ? String((r as any).leadId) : null,
      customerId: (r as any).customerId ? String((r as any).customerId) : null,
      caseId: (r as any).caseId ? String((r as any).caseId) : null,
      scheduledAt: (r as any).scheduledAt ? new Date((r as any).scheduledAt).toISOString() : null,
      durationMinutes: (r as any).durationMinutes ?? 30,
      followUpType: (r as any).followUpType ? String((r as any).followUpType) : null,
      status: String((r as any).status || 'SCHEDULED') === 'SCHEDULED' ? 'PENDING' : String((r as any).status || 'PENDING'),
      outcomeComments: (r as any).outcomeComments ?? null,
      outcomeHistory: Array.isArray((r as any).outcomeHistory)
        ? (r as any).outcomeHistory.map((h: any) => ({
            status: h?.status ? String(h.status) : '',
            outcomeComments: h?.outcomeComments ?? null,
            changedAt: h?.changedAt ? new Date(h.changedAt).toISOString() : null,
            changedBy: h?.changedBy ? String(h.changedBy) : null
          }))
        : [],
      assignedTo: (r as any).assignedTo ? String((r as any).assignedTo) : null,
      createdBy: (r as any).createdBy ? String((r as any).createdBy) : null,
      parentAppointmentId: (r as any).parentAppointmentId ? String((r as any).parentAppointmentId) : null,
      createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null,
      updatedAt: (r as any).updatedAt ? new Date((r as any).updatedAt).toISOString() : null,
      customerName: (r as any).customerName ? String((r as any).customerName) : null,
      leadTitle,
      assignedAgentName: (r as any).assignedAgentName ? String((r as any).assignedAgentName) : null,
      assignedAgentEmail: (r as any).assignedAgentEmail ?? null
    }
  })

  return NextResponse.json({ appointments })
}
