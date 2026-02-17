import { ObjectId } from 'mongodb'
import crypto from 'crypto'

import { getDb } from '@/lib/mongodb'

export type InviteRole = 'ADMIN' | 'USER'

export type CreateInvitationInput = {
  requesterUserId: string
  tenantId: string
  email: string
  role: InviteRole
}

export type CreateInvitationResult = {
  token: string
  expiresAt: Date
  tenantName: string
}

export async function createInvitation(input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const db = await getDb()
  const now = new Date()

  const requesterId = new ObjectId(input.requesterUserId)
  const tenantId = new ObjectId(input.tenantId)

  const ownerMembership = await db
    .collection('memberships')
    .findOne({ userId: requesterId, tenantId, role: 'OWNER', status: 'active' })

  if (!ownerMembership) {
    throw Object.assign(new Error('forbidden'), { status: 403 })
  }

  const tenant = await db.collection('tenants').findOne({ _id: tenantId }, { projection: { name: 1 } })
  const tenantName = (tenant?.name as string) || 'Your Tenant'

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  await db.collection('memberships').insertOne({
    userId: null,
    email: input.email,
    tenantId,
    role: input.role,
    status: 'invited',
    inviteToken: token,
    invitedBy: requesterId,
    invitedAt: now,
    createdAt: now,
    expiresAt
  })

  return { token, expiresAt, tenantName }
}

export type AcceptInvitationInput = {
  token: string
  sessionUserId: string
  sessionEmail: string
}

export type AcceptInvitationResult = {
  tenantId: string
}

export async function acceptInvitation(input: AcceptInvitationInput): Promise<AcceptInvitationResult> {
  const db = await getDb()
  const now = new Date()

  const invited = await db
    .collection('memberships')
    .findOne({ inviteToken: input.token, status: 'invited', expiresAt: { $gt: now } })
  if (!invited) {
    throw Object.assign(new Error('invalid_token'), { status: 400 })
  }

  if (
    typeof invited.email !== 'string' ||
    invited.email.toLowerCase() !== input.sessionEmail.toLowerCase()
  ) {
    throw Object.assign(new Error('email_mismatch'), { status: 403 })
  }

  if (invited.userId) {
    throw Object.assign(new Error('already_accepted'), { status: 409 })
  }

  const updated = await db.collection('memberships').findOneAndUpdate(
    {
      _id: invited._id,
      inviteToken: input.token,
      status: 'invited',
      expiresAt: { $gt: now }
    },
    {
      $set: {
        status: 'active',
        userId: new ObjectId(input.sessionUserId),
        activatedAt: now
      },
      $unset: { inviteToken: '' }
    },
    { returnDocument: 'after' }
  )

  const updatedDoc = updated.value
  if (!updatedDoc) {
    throw Object.assign(new Error('invalid_token'), { status: 400 })
  }

  await db.collection('memberships').updateMany(
    {
      tenantId: updatedDoc.tenantId,
      email: updatedDoc.email,
      status: 'invited',
      _id: { $ne: updatedDoc._id }
    },
    {
      $set: { status: 'revoked' },
      $unset: { inviteToken: '' }
    }
  )

  return { tenantId: (updatedDoc.tenantId as ObjectId).toHexString() }
}
