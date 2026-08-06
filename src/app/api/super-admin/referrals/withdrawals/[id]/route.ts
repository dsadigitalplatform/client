import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveWithdrawal } from '@features/referrals/services/referrals.server'

function requireSuperAdmin(session: any) {
  return Boolean(session?.userId && (session.isSuperAdmin || session.user?.isSuperAdmin))
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!requireSuperAdmin(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await ctx.params
  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const action = body?.action === 'paid' || body?.action === 'rejected' ? body.action : null

  if (!action) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
  }

  const db = await getDb()

  try {
    const withdrawal = await resolveWithdrawal({
      db,
      withdrawalId: id,
      actorUserId: String((session as any).userId),
      action,
      note: typeof body?.note === 'string' ? body.note : null
    })

    return NextResponse.json({ withdrawal })
  } catch (e: any) {
    const status = typeof e?.status === 'number' ? e.status : 500

    return NextResponse.json({ error: e?.message || 'internal_error' }, { status })
  }
}
