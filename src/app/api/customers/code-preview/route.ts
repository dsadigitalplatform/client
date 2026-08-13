export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { generateCustomerBusinessCode } from '@features/customers/server/customerCode.server'
import { getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  const fullName = body?.fullName != null ? String(body.fullName).trim() : ''

  const errors: Record<string, string> = {}

  if (fullName.length < 2) errors.fullName = 'Customer name is required'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  try {
    const preview = await generateCustomerBusinessCode({
      db: ctx.db,
      tenantId: ctx.tenantIdObj,
      fullName,
      preview: true
    })

    return NextResponse.json({ preview })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'preview_failed' }, { status: 400 })
  }
}
