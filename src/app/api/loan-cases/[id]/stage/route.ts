export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const AUDIT_ACTIONS = {
  leadStatusChanged: 'LEAD_STATUS_CHANGED'
} as const

async function writeAuditLog(params: {
  db: any
  actorUserId: ObjectId
  targetTenantId: ObjectId
  action: string
  metadata?: Record<string, any>
}) {
  const { db, actorUserId, targetTenantId, action, metadata } = params

  try {
    await db.collection('auditLogs').insertOne({
      actorUserId,
      targetTenantId,
      action,
      metadata: metadata ?? {},
      createdAt: new Date()
    })
  } catch (e: any) {
    const errMessage = e?.message || String(e)

    if (errMessage.includes('Document failed validation') && action !== 'ADMIN_VIEW') {
      try {
        await db.collection('auditLogs').insertOne({
          actorUserId,
          targetTenantId,
          action: 'ADMIN_VIEW',
          metadata: { ...(metadata ?? {}), requestedAction: action },
          createdAt: new Date()
        })

        return
      } catch (fallbackErr: any) {
        console.error('audit_log_write_failed', {
          action,
          fallbackAction: 'ADMIN_VIEW',
          actorUserId: actorUserId.toHexString(),
          tenantId: targetTenantId.toHexString(),
          err: fallbackErr?.message || String(fallbackErr)
        })

        return
      }
    }

    console.error('audit_log_write_failed', {
      action,
      actorUserId: actorUserId.toHexString(),
      tenantId: targetTenantId.toHexString(),
      err: errMessage
    })
  }
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
  const stageId = String(body?.newStageId || body?.stageId || '')

  if (!ObjectId.isValid(stageId)) return NextResponse.json({ error: 'invalid_stageId' }, { status: 400 })

  const stage = await db
    .collection('loanStatusPipelineStages')
    .findOne({ _id: new ObjectId(stageId), tenantId: tenantIdObj }, { projection: { _id: 1 } })

  if (!stage) return NextResponse.json({ error: 'stage_not_found' }, { status: 400 })

  const nextStageObjId = new ObjectId(stageId)
  const currentStageId = (existing as any).stageId as ObjectId | undefined

  if (currentStageId && currentStageId.equals(nextStageObjId)) {
    return NextResponse.json({ ok: true })
  }

  const now = new Date()

  await db
    .collection('loanCases')
    .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: { stageId: nextStageObjId, updatedAt: now } })

  const [fromStage, toStage] = await Promise.all([
    currentStageId
      ? db.collection('loanStatusPipelineStages').findOne({ _id: currentStageId, tenantId: tenantIdObj }, { projection: { name: 1 } })
      : null,
    db.collection('loanStatusPipelineStages').findOne({ _id: nextStageObjId, tenantId: tenantIdObj }, { projection: { name: 1 } })
  ])

  await writeAuditLog({
    db,
    actorUserId: userId,
    targetTenantId: tenantIdObj,
    action: AUDIT_ACTIONS.leadStatusChanged,
    metadata: {
      leadId: id,
      fromStageId: currentStageId ? currentStageId.toHexString() : null,
      fromStageName: fromStage ? String((fromStage as any).name || '') : null,
      toStageId: nextStageObjId.toHexString(),
      toStageName: toStage ? String((toStage as any).name || '') : null
    }
  })

  return NextResponse.json({ ok: true, updatedAt: now.toISOString() })
}

