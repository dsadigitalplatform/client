export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { generateBusinessCode, getEffectiveTemplate, getOrCreateCodeConfig } from '@features/code-generation/server/codeGenerator.server'
import { ENTITY_CODE_META } from '@features/code-generation/server/entityCodeMeta'
import { getTenantContext } from '@features/loan-disbursements/server/disbursementApiShared'

import { authOptions } from '@/lib/auth'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const body = await request.json().catch(() => ({}))

  const customerName = body?.customerName != null ? String(body.customerName).trim() : ''
  const loanTypeName = body?.loanTypeName != null ? String(body.loanTypeName).trim() : ''
  const loanTypeCode = body?.loanTypeCode != null ? String(body.loanTypeCode).trim() : ''
  const bankName = body?.bankName != null ? String(body.bankName).trim() : ''
  const bankCode = body?.bankCode != null ? String(body.bankCode).trim() : ''

  const config = await getOrCreateCodeConfig(ctx.db, ctx.tenantIdObj, 'LEAD')
  const meta = ENTITY_CODE_META.LEAD
  const template = getEffectiveTemplate(config, meta.defaultSequencePadLength)

  try {
    const preview = await generateBusinessCode({
      db: ctx.db,
      tenantId: ctx.tenantIdObj,
      entityType: 'LEAD',
      context: {
        customerName: customerName || null,
        loanTypeName: loanTypeName || null,
        loanTypeCode: loanTypeCode || null,
        bankName: bankName || null,
        bankCode: bankCode || null,
        date: new Date()
      },
      preview: true
    })

    return NextResponse.json({
      template,
      preview
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'preview_failed' }, { status: 400 })
  }
}
