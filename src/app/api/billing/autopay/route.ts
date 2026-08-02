export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { startAutopaySubscription } from '@features/billing/services/checkout.server'

/** POST — start autopay (Stripe Checkout subscription, or Razorpay when BILLING_PROVIDER=razorpay) */
export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const actorUserId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId: actorUserId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db.collection('memberships').findOne(
    { tenantId, status: 'active', $or: orFilters },
    { projection: { role: 1 } }
  )

  if ((membership?.role as string) !== 'OWNER' && !isSuperAdmin) {
    return NextResponse.json({ error: 'owner_only' }, { status: 403 })
  }

  const result = await startAutopaySubscription({ db, tenantId })

  if (!result.ok) {
    return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
  }

  return NextResponse.json(result)
}
