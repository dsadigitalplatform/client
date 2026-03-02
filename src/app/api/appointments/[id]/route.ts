export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { upsertAppointmentReminder } from '@features/reminders/services/remindersServer'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

type Role = 'OWNER' | 'ADMIN' | 'USER'

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

function mapAppointment(row: any) {
  const statusRaw = row?.status ? String(row.status) : 'SCHEDULED'
  const status = statusRaw === 'SCHEDULED' ? 'PENDING' : statusRaw

  return {
    id: String(row?._id),
    leadId: row?.leadId ? String(row.leadId) : null,
    customerId: row?.customerId ? String(row.customerId) : null,
    caseId: row?.caseId ? String(row.caseId) : null,
    scheduledAt: row?.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    durationMinutes: row?.durationMinutes ?? 30,
    followUpType: row?.followUpType ? String(row.followUpType) : null,
    status,
    outcomeComments: row?.outcomeComments ?? null,
    outcomeHistory: Array.isArray(row?.outcomeHistory)
      ? row.outcomeHistory.map((h: any) => ({
          status: h?.status ? String(h.status) : '',
          outcomeComments: h?.outcomeComments ?? null,
          changedAt: h?.changedAt ? new Date(h.changedAt).toISOString() : null,
          changedBy: h?.changedBy ? String(h.changedBy) : null
        }))
      : [],
    assignedTo: row?.assignedTo ? String(row.assignedTo) : null,
    createdBy: row?.createdBy ? String(row.createdBy) : null,
    parentAppointmentId: row?.parentAppointmentId ? String(row.parentAppointmentId) : null,
    createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null
  }
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tctx = await getTenantContext(session as any)

  if ('error' in tctx) return tctx.error

  const { db, tenantIdObj, userId, role } = tctx

  const filter: any = { _id: new ObjectId(id), tenantId: tenantIdObj }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    filter.assignedTo = userId
  }

  const row = await db.collection('appointments').findOne(filter)

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const base = mapAppointment(row)

  const customerIdObj: ObjectId | null = (row as any).customerId ?? null
  const leadIdObj: ObjectId | null = (row as any).leadId ?? null
  const assignedToObj: ObjectId | null = (row as any).assignedTo ?? null

  const [customer, lead, assignedAgent] = await Promise.all([
    customerIdObj
      ? db
          .collection('customers')
          .findOne({ _id: customerIdObj, tenantId: tenantIdObj }, { projection: { fullName: 1, mobile: 1, email: 1 } })
      : null,
    leadIdObj
      ? db
          .collection('loanCases')
          .findOne({ _id: leadIdObj, tenantId: tenantIdObj }, { projection: { loanTypeId: 1, bankName: 1 } })
      : null,
    assignedToObj
      ? db.collection('users').findOne({ _id: assignedToObj }, { projection: { name: 1, email: 1 } })
      : null
  ])

  const loanTypeIdObj: ObjectId | null = (lead as any)?.loanTypeId ?? null

  const loanType = loanTypeIdObj
    ? await db.collection('loanTypes').findOne({ _id: loanTypeIdObj, tenantId: tenantIdObj }, { projection: { name: 1 } })
    : null

  const loanTypeName = loanType ? String((loanType as any).name || '') : null
  const bankName = lead && (lead as any).bankName != null ? String((lead as any).bankName) : null
  const leadTitle = loanTypeName ? `${loanTypeName}${bankName ? ` • ${bankName}` : ''}` : null

  return NextResponse.json({
    ...base,
    customerName: customer ? String((customer as any).fullName || '') : null,
    leadTitle,
    assignedAgentName: assignedAgent ? String((assignedAgent as any).name || '') : null,
    assignedAgentEmail: assignedAgent ? ((assignedAgent as any).email ?? null) : null,
    customer: customer
      ? {
          id: base.customerId!,
          fullName: String((customer as any).fullName || ''),
          mobile: (customer as any).mobile ?? null,
          email: (customer as any).email ?? null
        }
      : null,
    lead: base.leadId
      ? { id: base.leadId, title: leadTitle, loanTypeName, bankName }
      : null
  })
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tctx = await getTenantContext(session as any)

  if ('error' in tctx) return tctx.error

  const { db, tenantIdObj, userId, role } = tctx
  const body = await request.json().catch(() => ({}))

  const patch: any = {}
  const errors: Record<string, string> = {}

  if (body.scheduledAt !== undefined) {

    const d = body.scheduledAt ? new Date(body.scheduledAt) : null

    if (!d || Number.isNaN(d.getTime())) errors.scheduledAt = 'Invalid scheduledAt'
    else patch.scheduledAt = d
  }

  if (body.durationMinutes !== undefined) {

    const n = body.durationMinutes == null ? null : Number(body.durationMinutes)

    if (n == null) patch.durationMinutes = null
    else if (!(Number.isFinite(n) && n >= 1)) errors.durationMinutes = 'durationMinutes must be ≥ 1'
    else patch.durationMinutes = n
  }

  if (body.status !== undefined) {

    const s = body.status == null ? '' : String(body.status).toUpperCase().trim()

    if (!STATUS_VALUES.includes(s as any)) errors.status = 'Invalid status'
    else patch.status = s === 'PENDING' ? 'SCHEDULED' : s
  }

  if (body.outcomeComments !== undefined) {
    patch.outcomeComments = body.outcomeComments == null ? null : String(body.outcomeComments)
  }

  if (body.assignedTo !== undefined) {
    if (role !== 'ADMIN' && role !== 'OWNER') {
      errors.assignedTo = 'forbidden'
    } else {
    const v = body.assignedTo == null || String(body.assignedTo).trim().length === 0 ? null : String(body.assignedTo).trim()

    if (v == null) {
      patch.assignedTo = null
    } else if (!ObjectId.isValid(v)) {
      errors.assignedTo = 'Invalid assignedTo'
    } else {
      const assignedToObjId = new ObjectId(v)
      const ok = await ensureAssignedToInTenant(db, tenantIdObj, assignedToObjId)

      if (!ok) errors.assignedTo = 'assignedTo_not_in_tenant'
      else patch.assignedTo = assignedToObjId
    }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 })
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  patch.updatedAt = new Date()

  const filter: any = { _id: new ObjectId(id), tenantId: tenantIdObj }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    filter.assignedTo = userId
  }

  const current = await db
    .collection('appointments')
    .findOne(filter, { projection: { status: 1, outcomeComments: 1, scheduledAt: 1, assignedTo: 1, leadId: 1, customerId: 1, caseId: 1, followUpType: 1 } })

  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const now = patch.updatedAt
  const shouldAppendOutcomeHistory = body.status !== undefined || body.outcomeComments !== undefined

  const update: any = { $set: patch }

  if (shouldAppendOutcomeHistory) {
    update.$push = {
      outcomeHistory: {
        status: String((current as any).status || 'SCHEDULED'),
        outcomeComments: (current as any).outcomeComments ?? null,
        changedAt: now,
        changedBy: userId
      }
    }
  }

  await db.collection('appointments').updateOne(filter, update)

  if (patch.scheduledAt !== undefined || patch.assignedTo !== undefined) {
    const nextAssignedTo: ObjectId | null = patch.assignedTo === undefined ? ((current as any).assignedTo ?? null) : patch.assignedTo
    const nextScheduledAt: Date | null = patch.scheduledAt === undefined ? ((current as any).scheduledAt ?? null) : patch.scheduledAt

    if (!nextScheduledAt) {
      console.warn('reminder_skipped_missing_appointment_datetime', {
        tenantId: tenantIdObj.toHexString(),
        appointmentId: id
      })
    } else if (!nextAssignedTo) {
      console.warn('reminder_skipped_missing_assigned_user', {
        tenantId: tenantIdObj.toHexString(),
        appointmentId: id
      })
    } else {
      const customerIdObj: ObjectId | null = (current as any).customerId ?? null

      const customer = customerIdObj
        ? await db.collection('customers').findOne({ _id: customerIdObj, tenantId: tenantIdObj }, { projection: { fullName: 1 } })
        : null

      try {
        await upsertAppointmentReminder({
          db,
          tenantId: tenantIdObj,
          appointmentId: new ObjectId(id),
          userId: nextAssignedTo,
          caseId: ((current as any).caseId ?? null) as ObjectId | null,
          customerId: customerIdObj,
          customerName: customer ? String((customer as any).fullName || '') : null,
          followUpType: (current as any).followUpType,
          notes: null,
          appointmentDateTime: nextScheduledAt
        })
      } catch (e: any) {
        console.error('reminder_upsert_failed', {
          err: e?.message || String(e),
          tenantId: tenantIdObj.toHexString(),
          appointmentId: id
        })
      }
    }
  }

  return NextResponse.json({ ok: true })
}
