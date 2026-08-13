export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { generateCorporateBusinessCode } from '@features/corporates/server/corporateCode.server'
import { getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  const name = body?.name != null ? String(body.name).trim() : ''

  const errors: Record<string, string> = {}

  if (name.length < 2) errors.name = 'Corporate name is required'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  try {
    const preview = await generateCorporateBusinessCode({
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
