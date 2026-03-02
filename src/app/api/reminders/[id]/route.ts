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

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const tenantCtx = await getTenantContext(session as any)

  if ('error' in tenantCtx) return tenantCtx.error

  const { db, tenantIdObj, userId, role } = tenantCtx

  const body = await request.json().catch(() => ({}))
  const status = body?.status

  if (!isReminderStatus(status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })

  const existing = await db.collection('reminders').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (role !== 'ADMIN' && role !== 'OWNER') {
    const ownerId = (existing as any).userId as ObjectId | undefined

    if (!ownerId || !ownerId.equals(userId)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  await db.collection('reminders').updateOne(
    { _id: new ObjectId(id), tenantId: tenantIdObj },
    {
      $set: {
        status,
        updatedAt: new Date()
      }
    }
  )

  return NextResponse.json({ ok: true })
}

