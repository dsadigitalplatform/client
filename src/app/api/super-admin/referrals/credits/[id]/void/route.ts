import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { voidCredit } from '@features/referrals/services/referrals.server'

function requireSuperAdmin(session: any) {
  return Boolean(session?.userId && (session.isSuperAdmin || session.user?.isSuperAdmin))
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  const db = await getDb()

  try {
    const credit = await voidCredit(db, id)

    return NextResponse.json({ credit })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500

    return NextResponse.json({ error: e?.message || 'internal_error' }, { status })
  }
}
