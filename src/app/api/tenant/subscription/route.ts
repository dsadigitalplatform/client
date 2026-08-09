export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'
import { formatPlanMoney } from '@features/subscription-plans/currencies'
import { normalizePlanEntitlements } from '@features/subscription-plans/featureCatalog'
import {
  SUBSCRIPTION_CHANGE_COPY,
  SUBSCRIPTION_CHANGE_POLICY,
  classifyPlanChange,
  type PricedPlanRef
} from '@features/subscriptions/subscriptionChangePolicy'
import {
  resolvePlanEntitlements,
  resolveTenantEntitlements
} from '@features/subscriptions/services/entitlements.server'
import {
  ensureSubscriptionBillingReminders,
  updateTenantSubscriptionBilling
} from '@features/subscriptions/services/tenantSubscription.server'

async function getMembership(db: any, userId: ObjectId, tenantId: ObjectId, email: string) {
  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  return db.collection('memberships').findOne(
    { tenantId, status: 'active', $or: orFilters },
    { projection: { role: 1, userId: 1 } }
  )
}

export async function GET() {
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
  const userId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const membership = await getMembership(db, userId, tenantId, email)

  if (!membership && !(session as any)?.isSuperAdmin) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const role = (membership?.role as string | undefined) || null
  const resolved = await resolveTenantEntitlements(db, tenantId)
  const planResolved = await resolvePlanEntitlements(db, resolved.planId)

  let plan: any = null

  if (resolved.planId && ObjectId.isValid(resolved.planId)) {
    const planDoc = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(resolved.planId) })

    if (planDoc) {
      const entitlements = normalizePlanEntitlements((planDoc as any).entitlements || planDoc, (planDoc as any).maxUsers)

      plan = {
        _id: String(planDoc._id),
        name: planDoc.name,
        slug: planDoc.slug,
        description: planDoc.description,
        priceMonthly: planDoc.priceMonthly,
        priceYearly: (planDoc as any).priceYearly ?? null,
        currency: (planDoc as any).currency || 'INR',
        maxUsers: entitlements.limits.maxUsers,
        entitlements,
        priceLabel: formatPlanMoney(planDoc.priceMonthly as number, (planDoc as any).currency)
      }
    }
  }

  let billingContact = null as any

  if (resolved.subscription?.billingContactUserId && ObjectId.isValid(resolved.subscription.billingContactUserId)) {
    const contactId = new ObjectId(resolved.subscription.billingContactUserId)
    const user = await db.collection('users').findOne({ _id: contactId }, { projection: { name: 1, email: 1 } })
    const contactMembership = await db
      .collection('memberships')
      .findOne({ tenantId, userId: contactId, status: 'active' }, { projection: { role: 1 } })

    billingContact = {
      userId: contactId.toHexString(),
      name: (user as any)?.name ?? null,
      email: (user as any)?.email ?? null,
      role: (contactMembership as any)?.role ?? null
    }
  }

  const eligibleMemberships = await db
    .collection('memberships')
    .find(
      { tenantId, status: 'active', role: { $in: ['OWNER', 'ADMIN'] }, userId: { $ne: null } },
      { projection: { userId: 1, role: 1 } }
    )
    .toArray()

  const eligibleUserIds = eligibleMemberships
    .map(m => m.userId as ObjectId)
    .filter(Boolean)

  const eligibleUsers =
    eligibleUserIds.length > 0
      ? await db
          .collection('users')
          .find({ _id: { $in: eligibleUserIds } }, { projection: { name: 1, email: 1 } })
          .toArray()
      : []

  const userById = new Map(eligibleUsers.map(u => [(u._id as ObjectId).toHexString(), u]))

  const eligibleBillingContacts = eligibleMemberships
    .map(m => {
      const id = (m.userId as ObjectId).toHexString()
      const u = userById.get(id)

      return {
        userId: id,
        name: (u as any)?.name || (u as any)?.email || id,
        email: (u as any)?.email || null,
        role: m.role as string
      }
    })
    .filter(c => c.userId)

  const isOwner = role === 'OWNER' || Boolean((session as any)?.isSuperAdmin)
  const isBillingContact = resolved.subscription?.billingContactUserId === session.userId
  const tenantDoc = await db.collection('tenants').findOne({ _id: tenantId }, { projection: { name: 1 } })
  const tenantName = typeof (tenantDoc as any)?.name === 'string' ? String((tenantDoc as any).name).trim() : ''

  let pendingPlan: any = null

  if (resolved.subscription?.pendingPlanId && ObjectId.isValid(resolved.subscription.pendingPlanId)) {
    const pendingDoc = await db
      .collection('subscriptionPlans')
      .findOne({ _id: new ObjectId(resolved.subscription.pendingPlanId) })

    if (pendingDoc) {
      const entitlements = normalizePlanEntitlements(
        (pendingDoc as any).entitlements || pendingDoc,
        (pendingDoc as any).maxUsers
      )

      pendingPlan = {
        _id: String(pendingDoc._id),
        name: pendingDoc.name,
        slug: pendingDoc.slug,
        description: pendingDoc.description,
        priceMonthly: pendingDoc.priceMonthly,
        priceYearly: (pendingDoc as any).priceYearly ?? null,
        currency: (pendingDoc as any).currency || 'INR',
        maxUsers: entitlements.limits.maxUsers,
        entitlements,
        priceLabel: formatPlanMoney(pendingDoc.priceMonthly as number, (pendingDoc as any).currency)
      }
    }
  }

  const rawPlans = await db
    .collection('subscriptionPlans')
    .find({ isActive: true })
    .sort({ isDefault: -1, priceMonthly: 1 })
    .toArray()

  const currentInterval = (resolved.subscription?.billingInterval || 'monthly') as 'monthly' | 'yearly'
  const currentPriced: PricedPlanRef | null = plan
    ? {
        _id: plan._id,
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly ?? null,
        currency: plan.currency,
        entitlements: plan.entitlements
      }
    : null

  const availablePlans = rawPlans.map(p => {
    const entitlements = normalizePlanEntitlements((p as any).entitlements || p, (p as any).maxUsers)
    const priced: PricedPlanRef = {
      _id: String(p._id),
      name: String(p.name || ''),
      priceMonthly: Number(p.priceMonthly) || 0,
      priceYearly: typeof (p as any).priceYearly === 'number' ? (p as any).priceYearly : null,
      currency: String((p as any).currency || 'INR'),
      entitlements
    }

    const changeKind =
      currentPriced && resolved.subscription
        ? classifyPlanChange({
            currentPlanId: resolved.subscription.planId,
            targetPlanId: priced._id,
            current: currentPriced,
            target: priced,
            billingInterval: currentInterval
          })
        : null

    return {
      _id: priced._id,
      name: priced.name,
      slug: p.slug,
      description: p.description,
      priceMonthly: priced.priceMonthly,
      priceYearly: priced.priceYearly,
      currency: priced.currency,
      maxUsers: entitlements.limits.maxUsers,
      entitlements,
      priceLabel: formatPlanMoney(priced.priceMonthly, priced.currency),
      isDefault: Boolean((p as any).isDefault),
      trialDays: typeof (p as any).trialDays === 'number' ? (p as any).trialDays : null,
      trialEnabled: (p as any).trialEnabled !== false,
      changeKind
    }
  })

  return NextResponse.json({
    tenantName: tenantName || null,
    subscription: resolved.subscription,
    plan,
    entitlements: planResolved.entitlements,
    usage: resolved.usage,
    access: resolved.access,
    billingContact,
    eligibleBillingContacts,
    canManageBilling: isOwner || isBillingContact,
    canNominateBillingContact: isOwner,
    canChangePlan: isOwner,
    pendingPlan,
    availablePlans,
    changePolicy: {
      automaticRefunds: SUBSCRIPTION_CHANGE_POLICY.automaticRefunds,
      annualMidTermRefunds: SUBSCRIPTION_CHANGE_POLICY.annualMidTermRefunds,
      copy: SUBSCRIPTION_CHANGE_COPY
    }
  })
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const actorUserId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const membership = await getMembership(db, actorUserId, tenantId, email)
  const role = (membership?.role as string | undefined) || null
  const isOwner = role === 'OWNER' || Boolean((session as any)?.isSuperAdmin)

  if (!isOwner) {
    return NextResponse.json({ error: 'owner_only' }, { status: 403 })
  }

  let billingContactUserId: ObjectId | undefined

  if (typeof body?.billingContactUserId === 'string' && ObjectId.isValid(body.billingContactUserId)) {
    const nomineeId = new ObjectId(body.billingContactUserId)
    const nomineeMembership = await db.collection('memberships').findOne({
      tenantId,
      userId: nomineeId,
      status: 'active',
      role: { $in: ['OWNER', 'ADMIN'] }
    })

    if (!nomineeMembership) {
      return NextResponse.json({ error: 'invalid_billing_contact' }, { status: 400 })
    }

    billingContactUserId = nomineeId
  }

  if (typeof body?.renewalMode === 'string' && body.renewalMode === 'auto') {
    return NextResponse.json(
      {
        error: 'autopay_disabled',
        message: 'Autopay is temporarily unavailable. Renewal stays manual until Super Admin marks payment received.'
      },
      { status: 403 }
    )
  }

  const updated = await updateTenantSubscriptionBilling({
    db,
    tenantId,
    actorUserId,
    renewalMode: body?.renewalMode === 'manual' ? 'manual' : undefined,
    billingInterval: body?.billingInterval,
    billingContactUserId
  })

  if (!updated) return NextResponse.json({ error: 'no_subscription' }, { status: 404 })

  await ensureSubscriptionBillingReminders({
    db,
    tenantId,
    subscriptionId: new ObjectId(updated._id),
    billingContactUserId: new ObjectId(updated.billingContactUserId),
    periodEnd: new Date(updated.currentPeriodEnd),
    renewalMode: updated.renewalMode,
    reminderDaysBeforeDue: updated.reminderDaysBeforeDue
  })

  return NextResponse.json({ subscription: updated })
}
