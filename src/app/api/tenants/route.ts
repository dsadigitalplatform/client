import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'

import { getDb } from '@/lib/mongodb'
import { TRIAL_DAYS } from '@features/subscription-plans/featureCatalog'
import { findApplicableDiscount } from '@features/subscriptions/services/discountCodes.server'
import { createTenantSubscription } from '@features/subscriptions/services/tenantSubscription.server'
import { linkReferralAttribution } from '@features/referrals/services/referrals.server'

export async function POST(request: Request) {
  const HEX = /^#([A-Fa-f0-9]{6})$/
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 })
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const type = body?.type === 'sole_trader' || body?.type === 'company' ? body.type : undefined
  const subscriptionPlanIdRaw = typeof body?.subscriptionPlanId === 'string' ? body.subscriptionPlanId : ''
  const primaryColorRaw = typeof body?.primaryColor === 'string' ? body.primaryColor.trim() : ''
  const primaryColor = primaryColorRaw && HEX.test(primaryColorRaw) ? primaryColorRaw : undefined
  const discountCodeRaw = typeof body?.discountCode === 'string' ? body.discountCode.trim() : ''
  const referralToken = typeof body?.referralToken === 'string' ? body.referralToken.trim() : ''
  const referredByUserId =
    typeof body?.referredByUserId === 'string' && ObjectId.isValid(body.referredByUserId)
      ? body.referredByUserId
      : ''
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  if (!name || !type) return NextResponse.json({ success: false, error: 'invalid_input' }, { status: 400 })

  const db = await getDb()
  const now = new Date()
  const createdBy = new ObjectId(session.userId!)

  let subscriptionPlanId: ObjectId | undefined
  let trialDays = TRIAL_DAYS
  let trialEnabled = true

  if (subscriptionPlanIdRaw && ObjectId.isValid(subscriptionPlanIdRaw)) {
    const plan = await db
      .collection('subscriptionPlans')
      .findOne(
        { _id: new ObjectId(subscriptionPlanIdRaw), isActive: true },
        { projection: { _id: 1, trialDays: 1, trialEnabled: 1 } }
      )

    if (plan?._id) {
      subscriptionPlanId = plan._id as ObjectId
      if (typeof (plan as any).trialDays === 'number') trialDays = (plan as any).trialDays
      trialEnabled = (plan as any).trialEnabled !== false && trialDays > 0
    }
  }

  let discountCodeId: ObjectId | null = null
  let discountSnapshot = null as any

  if (discountCodeRaw) {
    const applied = await findApplicableDiscount({
      db,
      code: discountCodeRaw,
      planId: subscriptionPlanId || null
    })

    if (applied && 'error' in applied) {
      return NextResponse.json({ success: false, error: applied.error }, { status: 400 })
    }

    if (applied && 'discount' in applied) {
      discountCodeId = new ObjectId(applied.discount._id)
      discountSnapshot = applied.snapshot
    }
  }

  const insertTenant = await db.collection('tenants').insertOne({
    name,
    type,
    status: 'active',
    createdBy,
    createdAt: now,
    updatedAt: now,
    ...(subscriptionPlanId ? { subscriptionPlanId } : {}),
    ...(primaryColor ? { theme: { primaryColor } } : {})
  })

  await db.collection('memberships').insertOne({
    userId: createdBy,
    tenantId: insertTenant.insertedId,
    role: 'OWNER',
    status: 'active',
    createdAt: now,
    activatedAt: now
  })

  if (subscriptionPlanId) {
    await createTenantSubscription({
      db,
      tenantId: insertTenant.insertedId,
      planId: subscriptionPlanId,
      ownerUserId: createdBy,
      discountCodeId,
      discountSnapshot,
      trialEnabled,
      trialDays
    })

    if (discountCodeId) {
      await db.collection('discountCodes').updateOne({ _id: discountCodeId }, { $inc: { redemptionCount: 1 } })
    }
  }

  try {
    if (referralToken) {
      const invite = await db.collection('referralInvites').findOne({ token: referralToken })

      if (invite) {
        await linkReferralAttribution({
          db,
          referredTenantId: insertTenant.insertedId.toHexString(),
          referrerUserId: String(invite.referrerUserId),
          referralInviteId: String(invite._id),
          inviteeEmail: invite.inviteeEmail ? String(invite.inviteeEmail) : null,
          inviteeMobile: invite.inviteeMobile ? String(invite.inviteeMobile) : null,
          inviteeName: invite.inviteeName ? String(invite.inviteeName) : null
        })
      }
    } else if (isSuperAdmin && referredByUserId) {
      await linkReferralAttribution({
        db,
        referredTenantId: insertTenant.insertedId.toHexString(),
        referrerUserId: referredByUserId
      })
    }
  } catch (e) {
    console.error('[tenants] referral attribution failed', e)
  }

  return NextResponse.json({ success: true, tenantId: insertTenant.insertedId.toHexString() }, { status: 201 })
}
