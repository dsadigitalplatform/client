import type { Db, ObjectId } from 'mongodb'

export type ReminderSource = 'CASE_FOLLOW_UP' | 'APPOINTMENT'
export type ReminderStatus = 'pending' | 'done' | 'skipped'

function safeDate(input: unknown) {
  if (input == null) return null
  const d = input instanceof Date ? input : new Date(String(input))

  if (!Number.isFinite(d.getTime())) return null

  return d
}

function caseRefFrom(caseId: ObjectId, caseNumber?: unknown) {
  const num = caseNumber == null ? '' : String(caseNumber).trim()

  if (num.length > 0) return num

  const hex = caseId.toHexString()

  return hex.slice(Math.max(0, hex.length - 6))
}

async function ensureSinglePendingReminder(params: {
  db: Db
  tenantId: ObjectId
  userId: ObjectId
  source: ReminderSource
  caseId?: ObjectId | null
  appointmentId?: ObjectId | null
  customerId?: ObjectId | null
  title: string
  description: string | null
  reminderDateTime: Date
  caseRef?: string | null
}) {
  const { db, tenantId, userId, source, caseId, appointmentId, customerId, title, description, reminderDateTime, caseRef } = params

  const baseFilter: any = {
    tenantId,
    userId,
    source,
    status: 'pending',
    caseId: caseId ?? null,
    appointmentId: appointmentId ?? null
  }

  const existing = await db.collection('reminders').findOne(baseFilter, { sort: { updatedAt: -1, createdAt: -1 } })
  const now = new Date()

  if (existing?._id) {
    await db.collection('reminders').updateOne(
      { _id: existing._id, tenantId },
      {
        $set: {
          title,
          description,
          reminderDateTime,
          customerId: customerId ?? null,
          caseRef: caseRef ?? null,
          updatedAt: now
        }
      }
    )

    await db.collection('reminders').deleteMany({ ...baseFilter, _id: { $ne: existing._id } })

    return { id: String(existing._id) }
  }

  const insert = await db.collection('reminders').insertOne({
    tenantId,
    userId,
    source,
    status: 'pending' as ReminderStatus,
    title,
    description,
    reminderDateTime,
    caseId: caseId ?? null,
    appointmentId: appointmentId ?? null,
    customerId: customerId ?? null,
    caseRef: caseRef ?? null,
    createdAt: now,
    updatedAt: now
  })

  return { id: insert.insertedId.toHexString() }
}

export async function upsertCaseFollowUpReminder(params: {
  db: Db
  tenantId: ObjectId
  caseId: ObjectId
  userId: ObjectId | null
  customerId?: ObjectId | null
  reminderDateTime: unknown
  caseNumber?: unknown
}) {
  const { db, tenantId, caseId, userId, customerId, reminderDateTime, caseNumber } = params

  const dt = safeDate(reminderDateTime)

  if (!dt) return { skipped: true as const, reason: 'missing_date' as const }
  if (!userId) return { skipped: true as const, reason: 'missing_user' as const }

  const ref = caseRefFrom(caseId, caseNumber)

  const title = `Follow-up for Case #${ref}`
  const description = 'Auto-generated reminder for case'

  const out = await ensureSinglePendingReminder({
    db,
    tenantId,
    userId,
    source: 'CASE_FOLLOW_UP',
    caseId,
    appointmentId: null,
    customerId: customerId ?? null,
    title,
    description,
    reminderDateTime: dt,
    caseRef: ref
  })

  return { ok: true as const, reminderId: out.id }
}

export async function upsertAppointmentReminder(params: {
  db: Db
  tenantId: ObjectId
  appointmentId: ObjectId
  userId: ObjectId | null
  caseId?: ObjectId | null
  customerId?: ObjectId | null
  customerName?: string | null
  followUpType?: unknown
  notes?: unknown
  appointmentDateTime: unknown
}) {
  const { db, tenantId, appointmentId, userId, caseId, customerId, customerName, followUpType, notes, appointmentDateTime } = params

  const dt = safeDate(appointmentDateTime)

  if (!dt) return { skipped: true as const, reason: 'missing_date' as const }
  if (!userId) return { skipped: true as const, reason: 'missing_user' as const }

  const typeLabel = followUpType == null || String(followUpType).trim().length === 0 ? 'Follow-up' : String(followUpType).trim()
  const nameLabel = customerName == null || customerName.trim().length === 0 ? 'Customer' : customerName.trim()
  const title = `Appointment: ${typeLabel} with ${nameLabel}`
  const description = notes == null || String(notes).trim().length === 0 ? null : String(notes).trim()

  const out = await ensureSinglePendingReminder({
    db,
    tenantId,
    userId,
    source: 'APPOINTMENT',
    caseId: caseId ?? null,
    appointmentId,
    customerId: customerId ?? null,
    title,
    description,
    reminderDateTime: dt,
    caseRef: null
  })

  return { ok: true as const, reminderId: out.id }
}
