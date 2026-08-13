import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { isSupportedCurrency, normalizeCurrency } from '@features/subscription-plans/currencies'
import { TRIAL_DAYS, normalizePlanEntitlements } from '@features/subscription-plans/featureCatalog'
import {
  countActiveSubscribersOnPlan,
  propagatePlanCatalogEntitlementEdit
} from '@features/subscription-plans/services/planCatalogEdit.server'
import { parseEntitlementsFromBody, serializePlanDoc } from '@features/subscription-plans/services/planSerialization'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isPositiveNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

function isPositiveInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1
}

function isValidFeatures(obj: unknown): obj is Record<string, boolean> {
  if (typeof obj !== 'object' || obj == null) return false

  for (const v of Object.values(obj as Record<string, unknown>)) {
    if (typeof v !== 'boolean') return false
  }

  return true
}

async function findPlanDoc(db: Awaited<ReturnType<typeof getDb>>, idParam: string) {
  let doc: any = null

  if (ObjectId.isValid(idParam)) {
    doc = await db.collection('subscriptionPlans').findOne({ _id: new ObjectId(idParam) })
  }

  if (!doc) {
    doc = await db.collection('subscriptionPlans').findOne({ _id: idParam as any })
  }

  return doc
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const db = await getDb()
  const existing = await findPlanDoc(db, idParam)

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  let body: any

  try {
    body = await request.json()
  } catch {
    body = {}
  }

  const update: any = { updatedAt: new Date() }
  const previousEntitlements = normalizePlanEntitlements(existing.entitlements || existing, existing.maxUsers)
  let nextEntitlements = previousEntitlements
  let entitlementsChanged = false
  let priceChanged = false

  if (isNonEmptyString(body?.name)) update.name = body.name.trim()
  if (isNonEmptyString(body?.slug)) update.slug = body.slug.trim().toLowerCase()
  if (isNonEmptyString(body?.description)) update.description = body.description.trim()

  if (body?.priceMonthly != null) {
    if (!isPositiveNumber(body.priceMonthly)) return NextResponse.json({ error: 'invalid_priceMonthly' }, { status: 400 })
    if (Number(body.priceMonthly) !== Number(existing.priceMonthly)) priceChanged = true
    update.priceMonthly = body.priceMonthly
  }

  if (body?.priceYearly != null) {
    if (!isPositiveNumber(body.priceYearly)) return NextResponse.json({ error: 'invalid_priceYearly' }, { status: 400 })
    if (Number(body.priceYearly) !== Number(existing.priceYearly ?? NaN)) priceChanged = true
    update.priceYearly = body.priceYearly
  }

  if (isNonEmptyString(body?.currency)) {
    if (!isSupportedCurrency(body.currency)) {
      return NextResponse.json({ error: 'invalid_currency' }, { status: 400 })
    }

    update.currency = normalizeCurrency(body.currency)
  }

  if (body?.entitlements != null || body?.maxUsers != null) {
    const entitlements = parseEntitlementsFromBody(body, isPositiveInt(body?.maxUsers) ? body.maxUsers : undefined)

    update.entitlements = entitlements
    update.maxUsers = entitlements.limits.maxUsers
    nextEntitlements = entitlements
    entitlementsChanged = true
  } else if (body?.maxUsers != null) {
    if (!isPositiveInt(body.maxUsers)) return NextResponse.json({ error: 'invalid_maxUsers' }, { status: 400 })
    update.maxUsers = body.maxUsers
  }

  if (typeof body?.trialEnabled === 'boolean') {
    update.trialEnabled = body.trialEnabled

    if (!body.trialEnabled) {
      update.trialDays = 0
    } else if (typeof body?.trialDays !== 'number') {
      update.trialDays = TRIAL_DAYS
    }
  }

  if (typeof body?.trialDays === 'number' && Number.isInteger(body.trialDays) && body.trialDays >= 0) {
    update.trialDays = body.trialEnabled === false ? 0 : body.trialDays
  } else if (body?.trialDays === null) {
    update.trialDays = update.trialEnabled === false ? 0 : TRIAL_DAYS
  }

  if (typeof body?.features === 'object' && body.features != null) update.features = body.features

  if (body?.features != null && !isValidFeatures(body.features)) {
    return NextResponse.json({ error: 'invalid_features' }, { status: 400 })
  }

  if (typeof body?.isActive === 'boolean') {
    update.isActive = body.isActive
  }

  if (typeof body?.isDefault === 'boolean') {
    update.isDefault = body.isDefault
  }

  // Inactive plans must not stay recommended for new organisations
  if (update.isActive === false) {
    update.isDefault = false
  }

  const prevVersion =
    typeof existing.entitlementsVersion === 'number' && Number.isFinite(existing.entitlementsVersion)
      ? Math.trunc(existing.entitlementsVersion)
      : 1

  if (entitlementsChanged || priceChanged) {
    update.entitlementsVersion = prevVersion + 1
  }

  try {
    const col = db.collection('subscriptionPlans')
    const planObjectId = existing._id instanceof ObjectId ? existing._id : new ObjectId(String(existing._id))

    // Freeze prior entitlements on subscribers before catalog shrink lands.
    if (entitlementsChanged) {
      await propagatePlanCatalogEntitlementEdit({
        db,
        planId: planObjectId,
        previousEntitlements,
        nextEntitlements,
        nextVersion: update.entitlementsVersion || prevVersion + 1
      })
    }

    if (update.isDefault === true) {
      await col.updateMany(
        { _id: { $ne: existing._id } },
        { $set: { isDefault: false, updatedAt: new Date() } }
      )
    }

    await col.updateOne({ _id: existing._id }, { $set: update })
    const updatedDoc = await col.findOne({ _id: existing._id })

    if (!updatedDoc) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    const plan = serializePlanDoc(updatedDoc)

    return NextResponse.json({ plan })
  } catch (e: any) {
    const msg = String(e?.message || '')
    const isDup = msg.includes('duplicate key')
    const isValidation = msg.includes('Document failed validation') || e?.code === 121

    if (isDup) return NextResponse.json({ error: 'duplicate' }, { status: 409 })
    if (isValidation) return NextResponse.json({ error: 'invalid_input' }, { status: 400 })

    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const p = await ctx.params
  const idParam = p?.id

  if (!isNonEmptyString(idParam)) {
    return NextResponse.json({ error: 'id_required' }, { status: 400 })
  }

  const db = await getDb()
  const existing = await findPlanDoc(db, idParam)

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const activeSubscriberCount = await countActiveSubscribersOnPlan(db, String(existing._id))

  if (activeSubscriberCount > 0) {
    const orgLabel = activeSubscriberCount === 1 ? 'organisation' : 'organisations'

    return NextResponse.json(
      {
        error: 'plan_has_subscribers',
        message: `This plan is in use by ${activeSubscriberCount} ${orgLabel}. Remove or migrate those organisations first, or deactivate the plan instead of deleting it.`,
        activeSubscriberCount
      },
      { status: 409 }
    )
  }

  const col = db.collection('subscriptionPlans')
  const res = await col.deleteOne({ _id: existing._id })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ success: true })
}
