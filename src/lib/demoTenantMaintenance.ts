import 'server-only'

import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'

/** Collection groups hidden from the DB maintenance UI. */
export const DB_MAINTENANCE_UI_HIDDEN_GROUPS = ['Platform'] as const

const hiddenUiGroupSet = new Set<string>(DB_MAINTENANCE_UI_HIDDEN_GROUPS)

export function isDbMaintenanceGroupVisibleInUi(group: string): boolean {
  return !hiddenUiGroupSet.has(group)
}

/** Collections that must never be bulk-cleared or row-deleted via DB maintenance. */
export const DB_MAINTENANCE_DELETE_BLOCKED_COLLECTIONS = [
  'users',
  'authAccounts',
  'subscriptionPlans',
  'tenants',
  'referralProgramSettings'
] as const

const blockedDeleteSet = new Set<string>(DB_MAINTENANCE_DELETE_BLOCKED_COLLECTIONS)

/** Platform-wide masters: counts, view, and clear apply to the whole collection, not one tenant. */
export const DB_MAINTENANCE_GLOBAL_COLLECTIONS = ['discountCodes'] as const

const globalCollectionSet = new Set<string>(DB_MAINTENANCE_GLOBAL_COLLECTIONS)

export function isDbMaintenanceGlobalCollection(collection: string): boolean {
  return globalCollectionSet.has(collection)
}

/** Collections scoped by `tenantId`. */
export const DB_MAINTENANCE_TENANT_ID_COLLECTIONS = [
  'customers',
  'associates',
  'associateTypes',
  'advocates',
  'banks',
  'corporates',
  'loanTypes',
  'documentChecklists',
  'loanStatusPipelineStages',
  'loanTypeDocuments',
  'codeGenerationConfigs',
  'codeSequences',
  'loanCases',
  'appointments',
  'reminders',
  'loanDisbursementTrackers',
  'loanDisbursements',
  'tenantSubscriptions',
  'invoices',
  'payments',
  'billingCustomers',
  'memberships'
] as const

const tenantIdFieldSet = new Set<string>(DB_MAINTENANCE_TENANT_ID_COLLECTIONS)

const targetTenantFieldByCollection: Record<string, string> = {
  auditLogs: 'targetTenantId',
  referralCredits: 'referredTenantId'
}

export function isDbMaintenanceCollectionDeletable(collection: string): boolean {
  return !blockedDeleteSet.has(collection)
}

export async function resolveTenantForMaintenance(tenantIdRaw?: string): Promise<{
  tenantId: ObjectId
  tenantIdHex: string
  tenantName: string | null
  isDemo: boolean
}> {
  const tenantIdHex = typeof tenantIdRaw === 'string' ? tenantIdRaw.trim() : ''

  if (!tenantIdHex || !ObjectId.isValid(tenantIdHex)) {
    throw Object.assign(new Error('tenant_required'), { status: 400 })
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdHex)

  const tenant = await db.collection('tenants').findOne({ _id: tenantId }, { projection: { name: 1, isDemo: 1 } })

  if (!tenant) {
    throw Object.assign(new Error('tenant_not_found'), { status: 404 })
  }

  return {
    tenantId,
    tenantIdHex,
    tenantName: typeof (tenant as any).name === 'string' ? (tenant as any).name : null,
    isDemo: Boolean((tenant as any).isDemo)
  }
}

/** @deprecated Use resolveTenantForMaintenance — kept for older call sites. */
export async function resolveDemoTenantForMaintenance(tenantIdRaw?: string) {
  return resolveTenantForMaintenance(tenantIdRaw)
}

async function buildReferralWithdrawalsScopeFilter(tenantId: ObjectId): Promise<Record<string, unknown>> {
  const db = await getDb()

  const memberships = await db.collection('memberships').find({ tenantId }, { projection: { userId: 1 } }).toArray()
  const referrerUserIds = memberships
    .map(m => (m as any)?.userId)
    .filter((v: any) => v && typeof v === 'object' && typeof v.toHexString === 'function') as ObjectId[]

  const credits = await db
    .collection('referralCredits')
    .find({ referredTenantId: tenantId }, { projection: { withdrawalId: 1 } })
    .toArray()

  const withdrawalIds = Array.from(
    new Set(
      credits
        .map(c => (c as any)?.withdrawalId)
        .filter((v: any) => v && typeof v === 'object' && typeof v.toHexString === 'function')
        .map((v: ObjectId) => v.toHexString())
    )
  ).map(hex => new ObjectId(hex))

  const ors: Record<string, unknown>[] = []

  if (referrerUserIds.length > 0) ors.push({ referrerUserId: { $in: referrerUserIds } })
  if (withdrawalIds.length > 0) ors.push({ _id: { $in: withdrawalIds } })

  if (ors.length === 0) return { _id: { $exists: false } }
  if (ors.length === 1) return ors[0]

  return { $or: ors }
}

export async function buildTenantScopeFilter(
  collection: string,
  tenantId: ObjectId
): Promise<Record<string, unknown>> {
  if (!isDbMaintenanceCollectionDeletable(collection)) {
    throw Object.assign(new Error('collection_not_deletable'), { status: 403 })
  }

  if (isDbMaintenanceGlobalCollection(collection)) {
    return {}
  }

  if (collection === 'referralInvites') {
    return {
      $or: [{ referrerTenantId: tenantId }, { referredTenantId: tenantId }]
    }
  }

  if (collection === 'referralWithdrawals') {
    return buildReferralWithdrawalsScopeFilter(tenantId)
  }

  const targetField = targetTenantFieldByCollection[collection]

  if (targetField) {
    return { [targetField]: tenantId }
  }

  if (tenantIdFieldSet.has(collection)) {
    return { tenantId }
  }

  throw Object.assign(new Error('collection_not_deletable'), { status: 403 })
}

/** @deprecated Use buildTenantScopeFilter */
export async function buildDemoTenantScopeFilter(collection: string, tenantId: ObjectId) {
  return buildTenantScopeFilter(collection, tenantId)
}

export async function mergeWithTenantScopeFilter(
  collection: string,
  tenantId: ObjectId,
  baseFilter: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const scope = await buildTenantScopeFilter(collection, tenantId)
  const keys = Object.keys(baseFilter)

  if (keys.length === 0) return scope

  return { $and: [scope, baseFilter] }
}

/** @deprecated Use mergeWithTenantScopeFilter */
export async function mergeWithDemoTenantScopeFilter(
  collection: string,
  tenantId: ObjectId,
  baseFilter: Record<string, unknown>
) {
  return mergeWithTenantScopeFilter(collection, tenantId, baseFilter)
}
