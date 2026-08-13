export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDemoTenantIdOrNull, isDemoLoginEnabled } from '@/lib/demoLogin'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { resolveSubscriptionPlan } from '@features/subscription-plans/services/resolveSubscriptionPlan.server'
import { getCurrentTenantSubscriptionDoc } from '@features/subscriptions/services/entitlements.server'
import type { RenewalMode, SubscriptionStatus } from '@features/subscriptions/subscriptions.types'
import type { SubscriptionStatusSummary } from '@features/subscriptions/subscriptionStatusMessage'

function toIso(d: unknown): string | null {
  if (!d) return null
  const date = d instanceof Date ? d : new Date(String(d))

  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

async function resolveSubscriptionSummary(db: any, tenantId: ObjectId): Promise<SubscriptionStatusSummary | null> {
  let subDoc = await getCurrentTenantSubscriptionDoc(db, tenantId)

  if (!subDoc) {
    subDoc = await db.collection('tenantSubscriptions').findOne({ tenantId }, { sort: { updatedAt: -1 } })
  }

  if (!subDoc) return null

  const now = new Date()
  const status = subDoc.status as SubscriptionStatus
  const trialEndsAt = toIso(subDoc.trialEndsAt)
  const currentPeriodEnd = toIso(subDoc.currentPeriodEnd)
  const inTrial = status === 'trialing'
  let daysLeftInTrial: number | null = null

  if (inTrial && trialEndsAt) {
    daysLeftInTrial = Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
  }

  let pendingPlanName: string | null = null

  if (subDoc.pendingPlanId) {
    const pendingPlan = await db
      .collection('subscriptionPlans')
      .findOne({ _id: subDoc.pendingPlanId }, { projection: { name: 1 } })

    pendingPlanName = (pendingPlan?.name as string | undefined) || null
  }

  return {
    status,
    renewalMode: ((subDoc.renewalMode as RenewalMode) || 'manual') as RenewalMode,
    currentPeriodEnd,
    trialEndsAt,
    cancelAtPeriodEnd: Boolean(subDoc.cancelAtPeriodEnd),
    daysLeftInTrial,
    inTrial,
    pendingPlanName,
    pendingChangeEffectiveAt: toIso(subDoc.pendingChangeEffectiveAt)
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await request.formData()
  let tenantId = String(form.get('tenantId') || '')

  if (!tenantId) return NextResponse.json({ error: 'tenantId_required' }, { status: 400 })

  if ((session as any).isDemoMode && isDemoLoginEnabled()) {
    const demoTenantId = getDemoTenantIdOrNull()

    if (!demoTenantId) {
      return NextResponse.json({ error: 'demo_login_disabled' }, { status: 403 })
    }

    if (tenantId !== demoTenantId) {
      return NextResponse.json({ error: 'demo_tenant_only' }, { status: 403 })
    }

    tenantId = demoTenantId
  }

  const db = await getDb()

  const membership = await db
    .collection('memberships')
    .findOne({ userId: new ObjectId(session.userId), tenantId: new ObjectId(tenantId), status: 'active' })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect') || '/home'

  const ret = url.searchParams.get('return')

  if (ret === 'json') {
    const res = NextResponse.json({ success: true })

    res.cookies.set('CURRENT_TENANT_ID', tenantId, { path: '/', httpOnly: true })

    
return res
  }

  const res = NextResponse.redirect(new URL(redirectTo, url.origin))

  res.cookies.set('CURRENT_TENANT_ID', tenantId, { path: '/', httpOnly: true })

  
return res
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any)?.currentTenantId || '')
  const currentTenantId = resolveCurrentTenantId(session as any, cookieTenantId)

  if (currentTenantId && ObjectId.isValid(currentTenantId)) {
    const db = await getDb()
    const userId = new ObjectId(session.userId!)
    const email = String((session as any)?.user?.email || '')

    const emailFilter =
      email && email.length > 0
        ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
        : undefined

    const orFilters = [{ userId }] as any[]

    if (emailFilter) orFilters.push(emailFilter)
    const tenantId = new ObjectId(currentTenantId)

    const membership = await db
      .collection('memberships')
      .findOne({ tenantId, status: 'active', $or: orFilters }, { projection: { role: 1 } })

    const t = await db
      .collection('tenants')
      .findOne({ _id: tenantId }, { projection: { name: 1, subscriptionPlanId: 1, 'theme.primaryColor': 1 } })

    const role = (membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined) || undefined
    const tenantName = (t?.name as string | undefined) || undefined
    const primaryColor = ((t as any)?.theme?.primaryColor as string | undefined) || undefined
    const subscriptionPlan = await resolveSubscriptionPlan(db, (t as any)?.subscriptionPlanId)
    const subscriptionSummary = await resolveSubscriptionSummary(db, tenantId)

    if (!cookieTenantId && sessionTenantId === currentTenantId) {
      const res = NextResponse.json({
        currentTenantId,
        role,
        tenantName,
        primaryColor,
        subscriptionPlan,
        subscriptionSummary
      })

      res.cookies.set('CURRENT_TENANT_ID', currentTenantId, { path: '/', httpOnly: true })

      return res
    }

    return NextResponse.json({
      currentTenantId,
      role,
      tenantName,
      primaryColor,
      subscriptionPlan,
      subscriptionSummary
    })
  }

  const db = await getDb()
  const userId = new ObjectId(session.userId!)

  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const fallbackMembership = await db
    .collection('memberships')
    .findOne({ status: 'active', $or: orFilters }, { projection: { tenantId: 1, role: 1 }, sort: { createdAt: -1 } })

  const fallbackTenantId = fallbackMembership?.tenantId ? (fallbackMembership.tenantId as ObjectId).toHexString() : ''

  if (fallbackTenantId && ObjectId.isValid(fallbackTenantId)) {
    const tenantId = new ObjectId(fallbackTenantId)

    const t = await db
      .collection('tenants')
      .findOne({ _id: tenantId }, { projection: { name: 1, subscriptionPlanId: 1, 'theme.primaryColor': 1 } })

    const role = (fallbackMembership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined) || undefined
    const tenantName = (t?.name as string | undefined) || undefined
    const primaryColor = ((t as any)?.theme?.primaryColor as string | undefined) || undefined
    const subscriptionPlan = await resolveSubscriptionPlan(db, (t as any)?.subscriptionPlanId)
    const subscriptionSummary = await resolveSubscriptionSummary(db, tenantId)

    const res = NextResponse.json({
      currentTenantId: fallbackTenantId,
      role,
      tenantName,
      primaryColor,
      subscriptionPlan,
      subscriptionSummary
    })

    res.cookies.set('CURRENT_TENANT_ID', fallbackTenantId, { path: '/', httpOnly: true })

    return res
  }

  return NextResponse.json({ currentTenantId })
}
