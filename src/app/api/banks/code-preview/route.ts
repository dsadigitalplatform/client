export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { generateBankBusinessCode } from '@features/banks/server/bankCode.server'
import { getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  const name = body?.name != null ? String(body.name).trim() : ''

  if (name.length < 2) {
    return NextResponse.json({ error: 'validation_error', details: { name: 'Bank name is required' } }, { status: 400 })
  }

  try {
    const preview = await generateBankBusinessCode({
      db: ctx.db,
      tenantId: ctx.tenantIdObj,
      name,
      preview: true
    })

    return NextResponse.json({ preview })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'preview_failed' }, { status: 400 })
  }
}
