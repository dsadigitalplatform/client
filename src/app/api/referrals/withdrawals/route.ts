import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { requestWithdrawal } from '@features/referrals/services/referrals.server'
import type { ReferralPayoutDetails } from '@features/referrals/referrals.types'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session as any)?.userId as string | undefined

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const creditIds = Array.isArray(body?.creditIds) ? body.creditIds.map(String) : []
  const payoutDetails = body?.payoutDetails as ReferralPayoutDetails

  if (!payoutDetails || (payoutDetails.method !== 'upi' && payoutDetails.method !== 'bank')) {
    return NextResponse.json({ error: 'invalid_payout' }, { status: 400 })
  }

  const db = await getDb()
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(userId) },
    { projection: { name: 1, email: 1 } }
  )

  try {
    const withdrawal = await requestWithdrawal({
      db,
      referrerUserId: userId,
      creditIds,
      payoutDetails,
      referrerName: user?.name ? String(user.name) : null,
      referrerEmail: user?.email ? String(user.email) : null
    })

    return NextResponse.json({ withdrawal }, { status: 201 })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500

    return NextResponse.json({ error: e?.message || 'internal_error' }, { status })
  }
}
