import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { linkReferralAttribution } from '@features/referrals/services/referrals.server'

function requireSuperAdmin(session: any) {
  return Boolean(session?.userId && (session.isSuperAdmin || session.user?.isSuperAdmin))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const referredTenantId = String(body?.referredTenantId || '')
  const referrerUserId = String(body?.referrerUserId || '')

  if (!referredTenantId || !referrerUserId) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 })
  }

  const db = await getDb()

  try {
    const invite = await linkReferralAttribution({
      db,
      referredTenantId,
      referrerUserId,
      referralInviteId: body?.referralInviteId || null,
      inviteeEmail: body?.inviteeEmail || null,
      inviteeMobile: body?.inviteeMobile || null,
      inviteeName: body?.inviteeName || null
    })

    return NextResponse.json({ invite })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500

    return NextResponse.json({ error: e?.message || 'internal_error' }, { status })
  }
}
