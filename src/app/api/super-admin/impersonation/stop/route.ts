import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const active = Boolean((session as any)?.impersonation?.active)

  if (!active) return NextResponse.json({ error: 'no_active_impersonation' }, { status: 400 })

  return NextResponse.json({ ok: true })
}
