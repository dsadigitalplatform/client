import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { getOrCreateReferralSettings } from '@features/referrals/services/referrals.server'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const db = await getDb()
  const settings = await getOrCreateReferralSettings(db)

  return NextResponse.json({ settings })
}
