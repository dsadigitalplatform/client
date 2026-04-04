export const dynamic = 'force-dynamic'

import crypto from 'crypto'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { sendInvitationEmail } from '@/lib/mailer'

type MembershipRole = 'OWNER' | 'ADMIN' | 'USER'
type MembershipStatus = 'invited' | 'active' | 'revoked'

type MembershipItem = {
  _id: string
  userId?: string
  email?: string
  role: MembershipRole
  status: MembershipStatus
  invitedById?: string
  invitedByName?: string
}

type RevokeInvitePayload = {
  tenantId?: string
  membershipId?: string
  action?: 'revoke_invite' | 'resend_invite'
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const tenantId = url.searchParams.get('tenantId') || ''

  if (!tenantId || !ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: 'invalid_tenantId' }, { status: 400 })
  }

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const ownerMembership = await db
    .collection('memberships')
    .findOne({
      tenantId: new ObjectId(tenantId),
      $or: orFilters,
      role: { $in: ['OWNER', 'ADMIN'] },
      status: 'active'
    })

  if (!ownerMembership) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const items = await db
    .collection('memberships')
    .find(
      {
        tenantId: new ObjectId(tenantId),
        status: { $in: ['invited', 'active'] },
        userId: { $ne: new ObjectId(session.userId) }
      },
      { projection: { _id: 1, userId: 1, email: 1, role: 1, status: 1, invitedBy: 1 } }
    )
    .toArray()

  const invitedByIds = Array.from(
    new Set(
      items
        .map(m => ((m as any).invitedBy as ObjectId | undefined)?.toHexString?.())
        .filter((id): id is string => Boolean(id))
    )
  )

  const inviters =
    invitedByIds.length > 0
      ? await db
          .collection('users')
          .find(
            { _id: { $in: invitedByIds.map(id => new ObjectId(id)) } },
            { projection: { _id: 1, name: 1, email: 1 } }
          )
          .toArray()
      : []

  const inviterNameById = new Map<string, string>(
    inviters.map(u => [
      (u._id as ObjectId).toHexString(),
      String((u as any).name || (u as any).email || '')
    ])
  )

  const memberships: MembershipItem[] = items.map(m => ({
    _id: (m._id as ObjectId).toHexString(),
    userId: ((m as any).userId as ObjectId | undefined)?.toHexString?.(),
    email: (m as any).email as string | undefined,
    role: m.role as MembershipRole,
    status: m.status as MembershipStatus,
    invitedById: ((m as any).invitedBy as ObjectId | undefined)?.toHexString?.(),
    invitedByName: inviterNameById.get(((m as any).invitedBy as ObjectId | undefined)?.toHexString?.() || '')
  }))

  return NextResponse.json({ memberships })
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as RevokeInvitePayload
  const tenantId = String(body?.tenantId || '')
  const membershipId = String(body?.membershipId || '')
  const action = body?.action

  if (action !== 'revoke_invite' && action !== 'resend_invite') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  if (!tenantId || !ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: 'invalid_tenantId' }, { status: 400 })
  }

  if (!membershipId || !ObjectId.isValid(membershipId)) {
    return NextResponse.json({ error: 'invalid_membershipId' }, { status: 400 })
  }

  const db = await getDb()
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)
  const requesterId = new ObjectId(session.userId)
  const requesterEmail = String((session as any)?.user?.email || '')

  const requesterEmailFilter =
    requesterEmail && requesterEmail.length > 0
      ? { email: { $regex: `^${requesterEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId: requesterId }] as any[]

  if (requesterEmailFilter) orFilters.push(requesterEmailFilter)

  const tenantIdObj = new ObjectId(tenantId)

  const targetMembershipId = new ObjectId(membershipId)

  const targetMembership = await db.collection('memberships').findOne(
    {
      _id: targetMembershipId,
      tenantId: tenantIdObj,
      status: 'invited'
    },
    { projection: { role: 1, invitedBy: 1, email: 1, tenantId: 1 } }
  )

  if (!targetMembership) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
  }

  if (!isSuperAdmin) {
    const requesterMembership = await db
      .collection('memberships')
      .findOne({ tenantId: tenantIdObj, $or: orFilters, status: 'active' }, { projection: { role: 1 } })

    if (!requesterMembership) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const requesterRole = String((requesterMembership as any).role || 'USER') as MembershipRole
    const targetInvitedById = ((targetMembership as any).invitedBy as ObjectId | undefined)?.toHexString?.() || ''
    const isOwner = requesterRole === 'OWNER'
    const isAdminRevokingOwnInvite = requesterRole === 'ADMIN' && targetInvitedById === requesterId.toHexString()

    if (!isOwner && !isAdminRevokingOwnInvite) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
  }

  const now = new Date()

  if (action === 'resend_invite') {
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)
    const invitedEmail = String((targetMembership as any).email || '').trim()

    if (!invitedEmail) {
      return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
    }

    const resendResult = await db.collection('memberships').updateOne(
      {
        _id: targetMembershipId,
        tenantId: tenantIdObj,
        status: 'invited'
      },
      {
        $set: {
          inviteToken: token,
          expiresAt,
          invitedBy: requesterId,
          invitedAt: now,
          updatedAt: now
        }
      }
    )

    if (resendResult.matchedCount === 0) {
      return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
    }

    const tenant = await db.collection('tenants').findOne({ _id: tenantIdObj }, { projection: { name: 1 } })
    const tenantName = String((tenant as any)?.name || 'Your Tenant')

    await sendInvitationEmail(invitedEmail, tenantName, token)

    return NextResponse.json({ success: true })
  }

  const result = await db.collection('memberships').updateOne(
    {
      _id: targetMembershipId,
      tenantId: tenantIdObj,
      status: 'invited'
    },
    {
      $set: {
        status: 'revoked',
        revokedAt: now,
        revokedBy: requesterId,
        updatedAt: now
      },
      $unset: {
        inviteToken: '',
        expiresAt: ''
      }
    }
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'invite_not_found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
