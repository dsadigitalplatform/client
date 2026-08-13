import 'server-only'

import type { Db } from 'mongodb'
import { ObjectId } from 'mongodb'

import { normalizePlanEntitlements, type PlanEntitlements } from '@features/subscription-plans/featureCatalog'
import {
  classifyCatalogEntitlementChange,
  mergeEntitlementsPreferHigher
} from '@features/subscription-plans/planCatalogEditPolicy'

const ACTIVE_STATUSES = ['trialing', 'active', 'past_due']

export async function countActiveSubscribersOnPlan(db: Db, planId: string | ObjectId): Promise<number> {
  const id = typeof planId === 'string' ? planId : planId.toHexString()

  if (!ObjectId.isValid(id)) return 0

  const oid = new ObjectId(id)

  const [activeSubs, tenantsOnPlan] = await Promise.all([
    db.collection('tenantSubscriptions').countDocuments({
      planId: oid,
      status: { $in: ACTIVE_STATUSES }
    }),
    db.collection('tenants').countDocuments({
      subscriptionPlanId: oid
    })
  ])

  // Prefer the higher signal — some orgs only have tenants.subscriptionPlanId (legacy).
  return Math.max(activeSubs, tenantsOnPlan)
}

/**
 * After a catalog entitlement shrink, freeze prior rights onto each subscriber's snapshot
 * so resolveTenantEntitlements can keep them until period end.
 */
export async function propagatePlanCatalogEntitlementEdit(params: {
  db: Db
  planId: ObjectId
  previousEntitlements: PlanEntitlements
  nextEntitlements: PlanEntitlements
  nextVersion: number
}): Promise<{ frozenSubscriberCount: number }> {
  const { db, planId, previousEntitlements, nextEntitlements, nextVersion } = params
  const { shrinks } = classifyCatalogEntitlementChange(previousEntitlements, nextEntitlements)

  if (!shrinks) {
    return { frozenSubscriberCount: 0 }
  }

  const subs = await db
    .collection('tenantSubscriptions')
    .find({ planId, status: { $in: ACTIVE_STATUSES } })
    .project({ _id: 1, entitlementsSnapshot: 1 })
    .toArray()

  let frozenSubscriberCount = 0
  const now = new Date()

  for (const sub of subs) {
    const existing = sub.entitlementsSnapshot
      ? normalizePlanEntitlements(sub.entitlementsSnapshot)
      : null
    // Keep any already-grandfathered higher rights, else freeze pre-edit catalog.
    const frozen = existing
      ? mergeEntitlementsPreferHigher(existing, previousEntitlements)
      : previousEntitlements

    await db.collection('tenantSubscriptions').updateOne(
      { _id: sub._id },
      {
        $set: {
          entitlementsSnapshot: frozen,
          entitlementsVersion: nextVersion,
          updatedAt: now
        }
      }
    )
    frozenSubscriberCount += 1
  }

  return { frozenSubscriberCount }
}

export function entitlementsSnapshotFromPlanDoc(planDoc: Record<string, any> | null | undefined): {
  entitlementsSnapshot: PlanEntitlements
  entitlementsVersion: number
} | null {
  if (!planDoc) return null

  return {
    entitlementsSnapshot: normalizePlanEntitlements(planDoc.entitlements || planDoc, planDoc.maxUsers),
    entitlementsVersion:
      typeof planDoc.entitlementsVersion === 'number' && Number.isFinite(planDoc.entitlementsVersion)
        ? Math.trunc(planDoc.entitlementsVersion)
        : 1
  }
}
