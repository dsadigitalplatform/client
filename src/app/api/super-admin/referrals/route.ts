import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import {
  adminListCredits,
  adminListInvites,
  adminListWithdrawals
} from '@features/referrals/services/referrals.server'

function requireSuperAdmin(session: any) {
  return Boolean(session?.userId && (session.isSuperAdmin || session.user?.isSuperAdmin))
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') || undefined
  const q = searchParams.get('q') || undefined
  const tab = searchParams.get('tab') || 'invites'

  const db = await getDb()

  if (tab === 'credits') {
    const credits = await adminListCredits(db)

    return NextResponse.json({ invites: [], credits, withdrawals: [] })
  }

  if (tab === 'withdrawals') {
    const withdrawals = await adminListWithdrawals(db, status)

    return NextResponse.json({ invites: [], credits: [], withdrawals })
  }

  const invites = await adminListInvites(db, { status, q })

  return NextResponse.json({ invites, credits: [], withdrawals: [] })
}
