import { TRIAL_DAYS, normalizePlanEntitlements, type PlanEntitlements } from '@features/subscription-plans/featureCatalog'

export function parseEntitlementsFromBody(body: any, fallbackMaxUsers?: number): PlanEntitlements {
  return normalizePlanEntitlements(body?.entitlements ?? body, fallbackMaxUsers)
}

export function serializePlanDoc(planDoc: Record<string, any>) {
  const entitlements = normalizePlanEntitlements(planDoc.entitlements || planDoc, planDoc.maxUsers)
  const trialEnabled = planDoc.trialEnabled !== false
  const trialDays =
    typeof planDoc.trialDays === 'number' && planDoc.trialDays >= 0 ? planDoc.trialDays : TRIAL_DAYS

  return {
    ...planDoc,
    _id: String(planDoc._id),
    maxUsers: entitlements.limits.maxUsers,
    entitlements,
    entitlementsVersion:
      typeof planDoc.entitlementsVersion === 'number' && Number.isFinite(planDoc.entitlementsVersion)
        ? Math.trunc(planDoc.entitlementsVersion)
        : 1,
    trialEnabled,
    trialDays: trialEnabled ? trialDays : 0,
    features: planDoc.features && typeof planDoc.features === 'object' ? planDoc.features : {}
  }
}
