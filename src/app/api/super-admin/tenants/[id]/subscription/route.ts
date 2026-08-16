export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
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
import { ensureEligibleDiscountOnSubscription } from '@features/subscriptions/services/discountCodes.server'
import { buildSubscriptionPricing, planPriceForInterval } from '@features/subscriptions/services/discountPricing'
import {
  assignTenantPlan,
  clearPendingPlanChange,
  extendTenantTrial,
  recordManualPayment,
  resumeTenantSubscription,
  scheduleTenantSubscriptionCancel,
  type ManualPaymentMethod
} from '@features/subscriptions/services/subscriptionChange.server'

async function requireSuperAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }
  if (!(session as any)?.isSuperAdmin && !(session as any)?.user?.isSuperAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { session }
}

function planPayload(planDoc: Record<string, any>) {
  const entitlements = normalizePlanEntitlements(planDoc.entitlements || planDoc, planDoc.maxUsers)

  return {
    _id: String(planDoc._id),
    name: planDoc.name,
    slug: planDoc.slug,
    description: planDoc.description,
    priceMonthly: planDoc.priceMonthly,
    priceYearly: (planDoc as any).priceYearly ?? null,
    currency: (planDoc as any).currency || 'INR',
    maxUsers: entitlements.limits.maxUsers,
    entitlements,
    isActive: planDoc.isActive !== false,
    priceLabel: formatPlanMoney(planDoc.priceMonthly as number, (planDoc as any).currency)
  }
}

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()

  if ('error' in auth) return auth.error

  const { id } = await ctx.params

  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const tenantId = new ObjectId(id)
  const tenant = await db.collection('tenants').findOne(
    { _id: tenantId },
    { projection: { name: 1, type: 1, status: 1, subscriptionPlanId: 1 } }
  )

  if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const resolved = await resolveTenantEntitlements(db, tenantId)
  const planResolved = await resolvePlanEntitlements(db, resolved.planId)

  let plan: any = null
  let planDoc: Record<string, any> | null = null

  if (resolved.planId && ObjectId.isValid(resolved.planId)) {
    planDoc = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(resolved.planId) })

    if (planDoc) plan = planPayload(planDoc as any)
  }

  let appliedSnapshot = resolved.subscription?.discountSnapshot || null
  let discountName: string | null = appliedSnapshot?.code || null

  if (resolved.subscription) {
    const attached = await ensureEligibleDiscountOnSubscription({
      db,
      tenantId,
      subscription: resolved.subscription,
      plan: planDoc
    })

    appliedSnapshot = attached.snapshot
    discountName = attached.discountName
    resolved.subscription.discountSnapshot = appliedSnapshot
  }

  const billingInterval = (resolved.subscription?.billingInterval || 'monthly') as 'monthly' | 'yearly'
  const pricing = plan
    ? buildSubscriptionPricing({
        originalAmount: planPriceForInterval(plan, billingInterval),
        currency: plan.currency,
        interval: billingInterval,
        snapshot: appliedSnapshot,
        discountName
      })
    : null

  let pendingPlan: any = null

  if (resolved.subscription?.pendingPlanId && ObjectId.isValid(resolved.subscription.pendingPlanId)) {
    const pendingDoc = await db
      .collection('subscriptionPlans')
      .findOne({ _id: new ObjectId(resolved.subscription.pendingPlanId) })

    if (pendingDoc) pendingPlan = planPayload(pendingDoc as any)
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
      currentPriced && resolved.planId
        ? classifyPlanChange({
            currentPlanId: resolved.planId,
            targetPlanId: priced._id,
            current: currentPriced,
            target: priced,
            billingInterval: currentInterval,
            nextBillingInterval: currentInterval
          })
        : null

    return {
      ...planPayload(p as any),
      changeKind: changeKind === 'same' ? 'same' : changeKind
    }
  })

  return NextResponse.json({
    tenant: {
      _id: String(tenant._id),
      name: tenant.name,
      type: tenant.type,
      status: tenant.status,
      subscriptionPlanId: (tenant as any).subscriptionPlanId
        ? String((tenant as any).subscriptionPlanId)
        : null
    },
    subscription: resolved.subscription,
    plan,
    pendingPlan,
    pricing,
    entitlements: resolved.entitlements,
    usage: resolved.usage,
    access: resolved.access,
    planResolved,
    availablePlans,
    changePolicy: {
      automaticRefunds: SUBSCRIPTION_CHANGE_POLICY.automaticRefunds,
      annualMidTermRefunds: SUBSCRIPTION_CHANGE_POLICY.annualMidTermRefunds,
      copy: SUBSCRIPTION_CHANGE_COPY
    }
  })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin()

  if ('error' in auth) return auth.error

  const { id } = await ctx.params

  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const db = await getDb()
  const tenantId = new ObjectId(id)
  const actorUserId = new ObjectId(auth.session.userId!)
  const action = String(body?.action || 'change_plan')
  const forceImmediate = Boolean(body?.forceImmediate)

  const tenant = await db.collection('tenants').findOne({ _id: tenantId }, { projection: { _id: 1 } })

  if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (action === 'cancel') {
    const result = await scheduleTenantSubscriptionCancel({ db, tenantId, forceImmediate })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'resume') {
    const result = await resumeTenantSubscription({ db, tenantId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'clear_pending') {
    const result = await clearPendingPlanChange({ db, tenantId })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'extend_trial') {
    const days = typeof body?.days === 'number' ? body.days : Number(body?.days)
    const result = await extendTenantTrial({ db, tenantId, days })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'mark_paid') {
    const method = String(body?.method || '') as ManualPaymentMethod
    const result = await recordManualPayment({
      db,
      tenantId,
      actorUserId,
      method,
      note: typeof body?.note === 'string' ? body.note : null,
      skipReferralCredit: Boolean(body?.skipReferralCredit)
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: 400 })
    }

    return NextResponse.json(result)
  }

  if (action === 'assign' || action === 'change_plan') {
    const planId = String(body?.planId || '')
    const billingInterval =
      body?.billingInterval === 'yearly' || body?.billingInterval === 'monthly' ? body.billingInterval : undefined
    const result = await assignTenantPlan({
      db,
      tenantId,
      actorUserId,
      targetPlanId: planId,
      billingInterval,
      forceImmediate
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          message: result.message,
          usageBlocks: result.usageBlocks
        },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 })
}
