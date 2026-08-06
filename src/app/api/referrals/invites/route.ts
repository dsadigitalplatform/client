import { NextResponse } from 'next/server'

import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { createReferralInvite } from '@features/referrals/services/referrals.server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session as any)?.userId as string | undefined

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const store = await cookies()
  const tenantId = store.get('CURRENT_TENANT_ID')?.value || ''

  if (!tenantId || !ObjectId.isValid(tenantId)) {
    return NextResponse.json({ error: 'no_tenant' }, { status: 400 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const db = await getDb()
  const membership = await db.collection('memberships').findOne({
    userId: new ObjectId(userId),
    tenantId: new ObjectId(tenantId),
    status: 'active'
  })

  if (!membership && !(session as any)?.isSuperAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { name: 1, email: 1 } }
  )

  try {
    const invite = await createReferralInvite({
      db,
      referrerUserId: userId,
      referrerTenantId: tenantId,
      inviteeEmail: String(body?.inviteeEmail || ''),
      inviteeMobile: String(body?.inviteeMobile || ''),
      inviteeName: typeof body?.inviteeName === 'string' ? body.inviteeName : null,
      referrerName: user?.name ? String(user.name) : null,
      referrerEmail: user?.email ? String(user.email) : null
    })

    return NextResponse.json({ invite }, { status: 201 })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500

    return NextResponse.json({ error: e?.message || 'internal_error' }, { status })
  }
}
