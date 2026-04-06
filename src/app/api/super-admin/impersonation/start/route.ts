import { randomUUID } from 'crypto'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const actorUserId = String((session as any)?.userId || '')

  if (!actorUserId || !ObjectId.isValid(actorUserId)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const targetUserId = String(body?.targetUserId || '')
  const tenantId = String(body?.tenantId || '')
  const reason = String(body?.reason || '').trim()

  if (!targetUserId || !ObjectId.isValid(targetUserId)) {
    return NextResponse.json({ error: 'invalid_target_user' }, { status: 400 })
  }

  if (targetUserId === actorUserId) {
    return NextResponse.json({ error: 'cannot_impersonate_self' }, { status: 400 })
  }

  if (tenantId && !ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })
  }

  const db = await getDb()

  const targetUser = await db
    .collection('users')
    .findOne({ _id: new ObjectId(targetUserId) }, { projection: { _id: 1, email: 1, name: 1 } })

  if (!targetUser) return NextResponse.json({ error: 'target_not_found' }, { status: 404 })
  const targetEmail = String((targetUser as any)?.email || '')

  if (tenantId) {
    const orFilters = [{ userId: new ObjectId(targetUserId) }] as any[]

    if (targetEmail) {
      orFilters.push({ email: { $regex: `^${escapeRegexLiteral(targetEmail)}$`, $options: 'i' } })
    }

    const membership = await db.collection('memberships').findOne({
      tenantId: new ObjectId(tenantId),
      status: 'active',
      $or: orFilters
    })

    if (!membership) return NextResponse.json({ error: 'target_not_member' }, { status: 400 })
  }

  const now = new Date()
  const nonce = `${randomUUID()}-${randomUUID()}`
  const expiresAt = new Date(now.getTime() + 60 * 1000)
  const actorObjId = new ObjectId(actorUserId)
  const targetObjId = new ObjectId(targetUserId)
  const tenantObjId = tenantId ? new ObjectId(tenantId) : null

  const auditInsert = await db.collection('impersonationAudits').insertOne({
    actorUserId: actorObjId,
    targetUserId: targetObjId,
    tenantId: tenantObjId,
    reason: reason || null,
    status: 'requested',
    createdAt: now,
    updatedAt: now,
    requestedAt: now,
    actorEmail: String((session as any)?.user?.email || '') || null,
    targetEmail: targetEmail || null,
    ip: request.headers.get('x-forwarded-for') || null,
    userAgent: request.headers.get('user-agent') || null
  })

  await db.collection('impersonationNonces').insertOne({
    nonce,
    actorUserId: actorObjId,
    targetUserId: targetObjId,
    tenantId: tenantObjId,
    reason: reason || null,
    auditId: auditInsert.insertedId,
    usedAt: null,
    expiresAt,
    createdAt: now,
    updatedAt: now
  })

  return NextResponse.json({
    nonce,
    expiresAt: expiresAt.toISOString(),
    target: {
      id: String((targetUser as any)._id),
      name: String((targetUser as any)?.name || ''),
      email: (targetUser as any)?.email ?? null
    }
  })
}
