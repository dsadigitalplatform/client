export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

async function getTenantContext(session: any) {
  const currentTenantId = String(session?.currentTenantId || '')

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

  return NextResponse.json({ ok: true, updatedAt: now.toISOString() })
}

