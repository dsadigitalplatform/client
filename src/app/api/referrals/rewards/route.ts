import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import {
  getMyRewardsSummary,
  listMyCredits,
  listMyReferralInvites,
  listMyWithdrawals
} from '@features/referrals/services/referrals.server'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session as any)?.userId as string | undefined

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const [summary, invites, credits, withdrawals] = await Promise.all([
    getMyRewardsSummary(db, userId),
    listMyReferralInvites(db, userId),
    listMyCredits(db, userId),
    listMyWithdrawals(db, userId)
  ])

  return NextResponse.json({ summary, invites, credits, withdrawals })
}
