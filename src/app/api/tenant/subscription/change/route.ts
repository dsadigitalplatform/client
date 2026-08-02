export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import {
  changeTenantSubscriptionPlan,
  clearPendingPlanChange,
  resumeTenantSubscription,
  scheduleTenantSubscriptionCancel
} from '@features/subscriptions/services/subscriptionChange.server'

async function getOwnerContext() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const actorUserId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId: actorUserId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db.collection('memberships').findOne(
    { tenantId, status: 'active', $or: orFilters },
    { projection: { role: 1 } }
  )

  const role = (membership?.role as string | undefined) || null
  const isOwner = role === 'OWNER' || isSuperAdmin

  if (!isOwner) {
    return { error: NextResponse.json({ error: 'owner_only' }, { status: 403 }) }
  }

  return { db, tenantId, actorUserId, session }
}

export async function POST(req: Request) {
  const ctx = await getOwnerContext()

  if ('error' in ctx) return ctx.error

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const action = String(body?.action || 'change_plan')

  if (action === 'cancel') {
    const result = await scheduleTenantSubscriptionCancel({ db: ctx.db, tenantId: ctx.tenantId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'resume') {
    const result = await resumeTenantSubscription({ db: ctx.db, tenantId: ctx.tenantId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'clear_pending') {
    const result = await clearPendingPlanChange({ db: ctx.db, tenantId: ctx.tenantId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  const planId = String(body?.planId || '')
  const billingInterval =
    body?.billingInterval === 'yearly' || body?.billingInterval === 'monthly' ? body.billingInterval : undefined

  const result = await changeTenantSubscriptionPlan({
    db: ctx.db,
    tenantId: ctx.tenantId,
    actorUserId: ctx.actorUserId,
    targetPlanId: planId,
    billingInterval
  })

  if (!result.ok) {
    const status = result.error === 'usage_exceeds_target' ? 409 : 400

    return NextResponse.json(
      { error: result.error, message: result.message, usageBlocks: result.usageBlocks },
      { status }
    )
  }

  return NextResponse.json(result)
}
