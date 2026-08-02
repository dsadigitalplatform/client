export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { getTenantInvoice } from '@features/billing/services/invoices.server'
import { buildInvoiceHtml } from '@features/billing/services/invoiceHtml.server'

async function tenantContext() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const userId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db.collection('memberships').findOne(
    { tenantId, status: 'active', $or: orFilters },
    { projection: { role: 1 } }
  )

  if (!membership && !isSuperAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { db, tenantId }
}

/** GET — printable GST invoice HTML */
export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await tenantContext()

  if ('error' in auth) return auth.error

  const { id } = await ctx.params
  const invoice = await getTenantInvoice(auth.db, auth.tenantId, id)

  if (!invoice) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const html = buildInvoiceHtml(invoice)

  return new NextResponse(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'content-disposition': `inline; filename="${invoice.invoiceNumber.replace(/\//g, '-')}.html"`
    }
  })
}
