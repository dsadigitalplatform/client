export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { generateAssociateBusinessCode } from '@features/associates/server/associateCode.server'
import { getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))
  const associateName = body?.associateName != null ? String(body.associateName).trim() : ''
  const companyName = body?.companyName != null ? String(body.companyName).trim() : ''

  const errors: Record<string, string> = {}

  if (associateName.length < 2) errors.associateName = 'Associate name is required'
  if (companyName.length < 2) errors.companyName = 'Company name is required'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  try {
    const preview = await generateAssociateBusinessCode({
      db: ctx.db,
      tenantId: ctx.tenantIdObj,
      associateName,
      companyName,
      preview: true
    })

    return NextResponse.json({ preview })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'preview_failed' }, { status: 400 })
  }
}
