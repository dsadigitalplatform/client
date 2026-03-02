export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const STATUS_VALUES = ['pending', 'done', 'skipped'] as const

type ReminderStatus = (typeof STATUS_VALUES)[number]

function isReminderStatus(v: unknown): v is ReminderStatus {
  return typeof v === 'string' && (STATUS_VALUES as readonly string[]).includes(v)
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx

  const url = new URL(request.url)
  const statusRaw = url.searchParams.get('status')
  const limitRaw = url.searchParams.get('limit')

  const status = statusRaw && isReminderStatus(statusRaw) ? statusRaw : 'pending'
  const limit = limitRaw && Number.isFinite(Number(limitRaw)) ? Math.max(1, Math.min(50, Math.floor(Number(limitRaw)))) : 20

  const match: any = { tenantId: tenantIdObj, status }

  if (role !== 'ADMIN' && role !== 'OWNER') match.userId = userId

  const rows = await db
    .collection('reminders')
    .aggregate([
      { $match: match },
      { $sort: { reminderDateTime: 1, updatedAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'customers',
          let: { customerId: '$customerId' },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ['$_id', '$$customerId'] }, { $eq: ['$tenantId', tenantIdObj] }] } } },
            { $project: { fullName: 1 } }
          ],
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } }
    ])
    .toArray()

  const items = rows.map(r => ({
    id: String((r as any)._id),
    title: String((r as any).title || ''),
    description: (r as any).description == null ? null : String((r as any).description),
    reminderDateTime: (r as any).reminderDateTime ? new Date((r as any).reminderDateTime).toISOString() : new Date().toISOString(),
    status: String((r as any).status || 'pending'),
    source: String((r as any).source || 'APPOINTMENT'),
    userId: String((r as any).userId || ''),
    caseId: (r as any).caseId ? String((r as any).caseId) : null,
    caseRef: (r as any).caseRef == null ? null : String((r as any).caseRef),
    customerId: (r as any).customerId ? String((r as any).customerId) : null,
    customerName: (r as any).customer?.fullName ? String((r as any).customer.fullName) : null,
    appointmentId: (r as any).appointmentId ? String((r as any).appointmentId) : null
  }))

  return NextResponse.json({ items })
}

