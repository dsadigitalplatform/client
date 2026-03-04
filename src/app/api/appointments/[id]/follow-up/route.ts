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

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tctx = await getTenantContext(session as any)

  if ('error' in tctx) return tctx.error

  const { db, tenantIdObj, userId, role } = tctx

  const originalFilter: any = { _id: new ObjectId(id), tenantId: tenantIdObj }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    originalFilter.createdBy = userId
  }

  const original = await db.collection('appointments').findOne(originalFilter, {
    projection: { tenantId: 1, leadId: 1, customerId: 1, caseId: 1, scheduledAt: 1 }
  })

  if (!original) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const body = await request.json().catch(() => ({}))

  const scheduledAtRaw = body.scheduledAt
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null
  const followUpType = String(body.followUpType || '').toUpperCase().trim()
  const outcomeCommentsRaw = body?.outcomeComments

  const outcomeComments =
    outcomeCommentsRaw == null || String(outcomeCommentsRaw).trim().length === 0 ? null : String(outcomeCommentsRaw).trim()

  const durationMinutes =
    body.durationMinutes == null || Number.isNaN(Number(body.durationMinutes)) ? 30 : Number(body.durationMinutes)

  const errors: Record<string, string> = {}

  if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) errors.scheduledAt = 'Invalid scheduledAt'
  if (!FOLLOW_UP_TYPES.includes(followUpType as any)) errors.followUpType = 'Invalid followUpType'
  if (!(durationMinutes >= 1)) errors.durationMinutes = 'durationMinutes must be ≥ 1'

  const parentScheduledAt = (original as any)?.scheduledAt ? new Date((original as any).scheduledAt) : null

  if (
    scheduledAt &&
    parentScheduledAt &&
    !Number.isNaN(parentScheduledAt.getTime()) &&
    scheduledAt.getTime() <= parentScheduledAt.getTime()
  ) {
    errors.scheduledAt = 'scheduledAt must be after parent appointment'
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    leadId: (original as any).leadId,
    customerId: (original as any).customerId,
    caseId: (original as any).caseId ?? null,
    scheduledAt: scheduledAt!,
    durationMinutes,
    followUpType,
    status: 'SCHEDULED',
    outcomeComments,
    createdBy: userId,
    parentAppointmentId: (original as any)._id,
    createdAt: now,
    updatedAt: now
  }

  const res = await db.collection('appointments').insertOne(doc)

  const customerIdObj: ObjectId | null = (original as any).customerId ?? null

  const customer = customerIdObj
    ? await db.collection('customers').findOne({ _id: customerIdObj, tenantId: tenantIdObj }, { projection: { fullName: 1 } })
    : null

  try {
    await upsertAppointmentReminder({
      db,
      tenantId: tenantIdObj,
      appointmentId: res.insertedId,
      userId,
      caseId: (original as any).caseId ?? null,
      customerId: customerIdObj,
      customerName: customer ? String((customer as any).fullName || '') : null,
      followUpType,
      notes: outcomeComments,
      appointmentDateTime: scheduledAt
    })
  } catch (e: any) {
    console.error('reminder_upsert_failed', {
      err: e?.message || String(e),
      tenantId: tenantIdObj.toHexString(),
      appointmentId: res.insertedId.toHexString()
    })
  }

  return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
}
