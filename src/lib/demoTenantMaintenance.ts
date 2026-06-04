import 'server-only'

import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'
import { getDemoTenantIdOrNull } from '@/lib/demoLogin'

/** Collection groups hidden from the DB maintenance UI (demo tenant workflow). */
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
  'tenants'
] as const

const blockedDeleteSet = new Set<string>(DB_MAINTENANCE_DELETE_BLOCKED_COLLECTIONS)

/** Collections scoped by `tenantId`. */
export const DB_MAINTENANCE_TENANT_ID_COLLECTIONS = [
  'customers',
  'associates',
  'advocates',
  'banks',
  'corporates',
  'loanTypes',
  'documentChecklists',
  'loanStatusPipelineStages',
  'loanTypeDocuments',
  'loanCases',
  'appointments',
  'loanDisbursementTrackers',
  'loanDisbursements',
  'memberships'
] as const

const tenantIdFieldSet = new Set<string>(DB_MAINTENANCE_TENANT_ID_COLLECTIONS)

const targetTenantFieldByCollection: Record<string, string> = {
  auditLogs: 'targetTenantId'
}

export function isDbMaintenanceCollectionDeletable(collection: string): boolean {
  return !blockedDeleteSet.has(collection)
}

export async function resolveDemoTenantForMaintenance(tenantIdRaw?: string): Promise<{
  tenantId: ObjectId
  tenantIdHex: string
  tenantName: string | null
}> {
  const demoTenantIdHex = getDemoTenantIdOrNull()

  if (!demoTenantIdHex) {
    throw Object.assign(new Error('demo_tenant_not_configured'), { status: 403 })
  }

  if (tenantIdRaw && tenantIdRaw !== demoTenantIdHex) {
    throw Object.assign(new Error('only_demo_tenant_deletable'), { status: 403 })
  }

  const db = await getDb()
  const tenantId = new ObjectId(demoTenantIdHex)

  const tenant = await db.collection('tenants').findOne(
    { _id: tenantId, isDemo: true },
    { projection: { name: 1 } }
  )

  if (!tenant) {
    throw Object.assign(new Error('demo_tenant_not_configured'), { status: 403 })
  }

  return {
    tenantId,
    tenantIdHex: demoTenantIdHex,
    tenantName: typeof (tenant as any).name === 'string' ? (tenant as any).name : null
  }
}

export function buildDemoTenantScopeFilter(collection: string, tenantId: ObjectId): Record<string, unknown> {
  if (!isDbMaintenanceCollectionDeletable(collection)) {
    throw Object.assign(new Error('collection_not_deletable'), { status: 403 })
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

export function mergeWithDemoTenantScopeFilter(
  collection: string,
  tenantId: ObjectId,
  baseFilter: Record<string, unknown>
): Record<string, unknown> {
  const scope = buildDemoTenantScopeFilter(collection, tenantId)
  const keys = Object.keys(baseFilter)

  if (keys.length === 0) return scope

  return { $and: [scope, baseFilter] }
}
