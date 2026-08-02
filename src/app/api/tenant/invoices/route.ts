export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { listTenantInvoices } from '@features/billing/services/invoices.server'

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

  return { db, tenantId, role: (membership?.role as string) || null, isSuperAdmin }
}

export async function GET(req: Request) {
  const ctx = await tenantContext()

  if ('error' in ctx) return ctx.error

  const url = new URL(req.url)
  const limit = Number(url.searchParams.get('limit') || 50)
  const invoices = await listTenantInvoices(ctx.db, ctx.tenantId, limit)

  return NextResponse.json({ invoices })
}
