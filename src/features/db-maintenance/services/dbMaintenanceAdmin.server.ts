import 'server-only'

import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'
import {
  buildDemoTenantScopeFilter,
  isDbMaintenanceCollectionDeletable,
  isDbMaintenanceGroupVisibleInUi,
  mergeWithDemoTenantScopeFilter,
  resolveDemoTenantForMaintenance
} from '@/lib/demoTenantMaintenance'

import type {
  DbMaintenanceClearResult,
  DbMaintenanceCollectionInfo,
  DbMaintenanceCreatorOption,
  DbMaintenanceDocumentPreview,
  DbMaintenanceTenantInfo,
  DbMaintenanceTenantPurgeResult
} from '../db-maintenance.types'
import {
  buildDbMaintenanceDocumentPreviews,
  getDbMaintenanceDocumentProjection
} from './documentPreview.server'

export const DB_MAINTENANCE_COLLECTIONS = [
  'users',
  'authAccounts',
  'tenants',
  'memberships',
  'auditLogs',
  'subscriptionPlans',
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
  'loanDisbursements'
] as const

const DB_MAINTENANCE_COLLECTION_META: Record<
  (typeof DB_MAINTENANCE_COLLECTIONS)[number],
  { label: string; group: string }
> = {
  users: { label: 'Users', group: 'Platform' },
  authAccounts: { label: 'Auth accounts', group: 'Platform' },
  tenants: { label: 'Tenants', group: 'Platform' },
  memberships: { label: 'Memberships', group: 'Platform' },
  auditLogs: { label: 'Audit logs', group: 'Platform' },
  subscriptionPlans: { label: 'Subscription plans', group: 'Platform' },
  customers: { label: 'Customers', group: 'DSA Master' },
  associates: { label: 'Associates', group: 'DSA Master' },
  advocates: { label: 'Advocates', group: 'DSA Master' },
  banks: { label: 'Banks', group: 'DSA Master' },
  corporates: { label: 'Corporates', group: 'DSA Master' },
  loanTypes: { label: 'Loan types', group: 'DSA Master' },
  documentChecklists: { label: 'Document checklists', group: 'DSA Master' },
  loanStatusPipelineStages: { label: 'Loan status pipeline', group: 'DSA Master' },
  loanTypeDocuments: { label: 'Loan type documents', group: 'DSA Master' },
  loanCases: { label: 'Leads / loan cases', group: 'Leads & operations' },
  appointments: { label: 'Appointments', group: 'Leads & operations' },
  loanDisbursementTrackers: { label: 'Disbursement trackers', group: 'Leads & operations' },
  loanDisbursements: { label: 'Disbursements', group: 'Leads & operations' }
}

const allowed = new Set<string>(DB_MAINTENANCE_COLLECTIONS)

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

export function isAllowedDbMaintenanceCollection(name: unknown): name is string {
  return isNonEmptyString(name) && allowed.has(name)
}

export async function listDbMaintenanceCollections(): Promise<DbMaintenanceCollectionInfo[]> {
  const db = await getDb()
  const out: DbMaintenanceCollectionInfo[] = []
  let demoTenantId: ObjectId | null = null

  try {
    const resolved = await resolveDemoTenantForMaintenance()

    demoTenantId = resolved.tenantId
  } catch {
    demoTenantId = null
  }

  for (const name of DB_MAINTENANCE_COLLECTIONS) {
    const exists = (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0
    const deletable = isDbMaintenanceCollectionDeletable(name)
    let documentCount = 0

    if (exists) {
      if (demoTenantId && deletable) {
        try {
          const filter = buildDemoTenantScopeFilter(name, demoTenantId)

          documentCount = await db.collection(name).countDocuments(filter)
        } catch {
          documentCount = 0
        }
      } else {
        documentCount = await db.collection(name).countDocuments({})
      }
    }

    const meta = DB_MAINTENANCE_COLLECTION_META[name as (typeof DB_MAINTENANCE_COLLECTIONS)[number]]
    const group = meta?.group || 'Other'

    if (!isDbMaintenanceGroupVisibleInUi(group)) continue

    out.push({
      name,
      label: meta?.label || name,
      group,
      exists,
      documentCount,
      deletable
    })
  }

  return out
}

export async function clearDbMaintenanceCollection(name: string): Promise<DbMaintenanceClearResult> {
  const { tenantId } = await resolveDemoTenantForMaintenance()
  const db = await getDb()

  const exists = (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0

  if (!exists) {
    return { name, before: 0, deleted: 0, after: 0 }
  }

  const scopeFilter = buildDemoTenantScopeFilter(name, tenantId)
  const coll = db.collection(name)
  const before = await coll.countDocuments(scopeFilter)
  const del = await coll.deleteMany(scopeFilter)
  const after = await coll.countDocuments(scopeFilter)

  return { name, before, deleted: del.deletedCount || 0, after }
}

function toIdString(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v?.toHexString === 'function') return v.toHexString()

  return String(v)
}

function buildCreatedByFilter(createdByIdRaw: string): Record<string, any> {
  const createdById = String(createdByIdRaw || '').trim()

  if (!createdById) return {}

  const filters: any[] = [{ createdBy: createdById }]

  if (ObjectId.isValid(createdById)) {
    filters.push({ createdBy: new ObjectId(createdById) })
  }

  return { $or: filters }
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const out: T[][] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize))
  }

  return out
}

async function deleteAuditLogsForLoanCaseIds(db: any, loanCaseIds: string[], demoTenantId?: ObjectId): Promise<number> {
  const ids = Array.from(new Set(loanCaseIds.map(v => String(v || '').trim()).filter(Boolean)))

  if (ids.length === 0) return 0

  const auditExists = (await db.listCollections({ name: 'auditLogs' }, { nameOnly: true }).toArray()).length > 0

  if (!auditExists) return 0

  let deletedTotal = 0

  for (const batch of chunkArray(ids, 200)) {
    const objectIds = batch.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
    const filters: any[] = [{ 'metadata.leadId': { $in: batch } }]

    if (objectIds.length > 0) {
      filters.push({ 'metadata.leadId': { $in: objectIds } })
    }

    let q: Record<string, unknown> = filters.length === 1 ? filters[0] : { $or: filters }

    if (demoTenantId) {
      q = { $and: [q, { targetTenantId: demoTenantId }] }
    }

    const res = await db.collection('auditLogs').deleteMany(q)

    deletedTotal += res.deletedCount || 0
  }

  return deletedTotal
}

export async function listDbMaintenanceDocuments(params: {
  collection: string
  limit?: number
  cursor?: string | null
  createdById?: string | null
}): Promise<{ items: DbMaintenanceDocumentPreview[]; nextCursor: string | null }> {
  const { tenantId } = await resolveDemoTenantForMaintenance()
  const db = await getDb()
  const collection = params.collection
  const limitRaw = typeof params.limit === 'number' ? params.limit : 50
  const limit = Math.max(1, Math.min(200, Math.floor(limitRaw)))

  const exists = (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0

  if (!exists) {
    return { items: [], nextCursor: null }
  }

  const query: any = {}
  const createdByFilter = params.createdById ? buildCreatedByFilter(params.createdById) : {}

  if (Object.keys(createdByFilter).length > 0) {
    query.$and = [...(query.$and || []), createdByFilter]
  }

  if (isDbMaintenanceCollectionDeletable(collection)) {
    const demoScope = buildDemoTenantScopeFilter(collection, tenantId)

    query.$and = [...(query.$and || []), demoScope]
  }

  if (params.cursor && typeof params.cursor === 'string' && params.cursor.trim().length > 0) {
    const c = params.cursor.trim()

    if (ObjectId.isValid(c)) query._id = { $lt: new ObjectId(c) }
  }

  const docs = await db
    .collection(collection)
    .find(query, { projection: getDbMaintenanceDocumentProjection(collection) })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray()

  const items = await buildDbMaintenanceDocumentPreviews(db, collection, docs)

  const last = docs.length > 0 ? docs[docs.length - 1] : null
  const nextCursor = last && typeof (last as any)?._id?.toHexString === 'function' ? (last as any)._id.toHexString() : null

  return { items, nextCursor }
}

export async function listDbMaintenanceCreators(params: { collection: string }): Promise<DbMaintenanceCreatorOption[]> {
  const { tenantId } = await resolveDemoTenantForMaintenance()
  const db = await getDb()
  const collection = params.collection

  const exist = (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0

  if (!exist) return []

  if (!isDbMaintenanceCollectionDeletable(collection)) return []

  const demoScope = buildDemoTenantScopeFilter(collection, tenantId)

  const creatorCounts = await db
    .collection(collection)
    .aggregate([
      { $match: { ...demoScope, createdBy: { $exists: true, $ne: null } } },
      { $project: { createdById: { $toString: '$createdBy' } } },
      { $match: { createdById: { $ne: '' } } },
      { $group: { _id: '$createdById', count: { $sum: 1 } } },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 500 }
    ])
    .toArray()

  if (creatorCounts.length === 0) return []

  const creatorIds = creatorCounts.map(row => String((row as any)._id || '')).filter(Boolean)
  const objectIds = creatorIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
  const usersById = new Map<string, { name: string; email: string | null }>()

  if (objectIds.length > 0) {
    const users = await db
      .collection('users')
      .find({ _id: { $in: objectIds } }, { projection: { _id: 1, name: 1, email: 1 } })
      .toArray()

    users.forEach(user => {
      const id = toIdString((user as any)?._id)

      usersById.set(id, {
        name: typeof (user as any)?.name === 'string' && (user as any).name.trim() ? String((user as any).name).trim() : id,
        email: typeof (user as any)?.email === 'string' && (user as any).email.trim() ? String((user as any).email).trim() : null
      })
    })
  }

  return creatorCounts.map(row => {
    const id = String((row as any)?._id || '')
    const info = usersById.get(id)
    const fallbackName = info?.email || id

    return {
      id,
      name: info?.name || fallbackName,
      email: info?.email || null,
      documentCount: Number((row as any)?.count || 0)
    }
  })
}

export async function deleteDbMaintenanceDocuments(params: {
  collection: string
  ids: string[]
  createdById?: string | null
}): Promise<{ deleted: number }> {
  const { tenantId } = await resolveDemoTenantForMaintenance()
  const db = await getDb()
  const collection = params.collection
  const ids = Array.isArray(params.ids) ? params.ids : []
  const unique = Array.from(new Set(ids.map(s => String(s || '').trim()).filter(Boolean))).slice(0, 500)
  const createdById = String(params.createdById || '').trim()
  const exist = (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0

  if (!exist) return { deleted: 0 }

  if (!isDbMaintenanceCollectionDeletable(collection)) {
    throw Object.assign(new Error('collection_not_deletable'), { status: 403 })
  }

  if (unique.length === 0 && !createdById) return { deleted: 0 }

  const ors: any[] = []

  for (const id of unique) {
    if (ObjectId.isValid(id)) ors.push({ _id: new ObjectId(id) })
    ors.push({ _id: id })
  }

  const queryParts: any[] = []

  if (ors.length > 0) queryParts.push({ $or: ors })
  if (createdById) queryParts.push(buildCreatedByFilter(createdById))

  const baseQuery = queryParts.length === 1 ? queryParts[0] : { $and: queryParts }
  const deleteQuery = mergeWithDemoTenantScopeFilter(collection, tenantId, baseQuery)
  let loanCaseIdsToDelete: string[] = []

  if (collection === 'loanCases') {
    const rows = await db.collection('loanCases').find(deleteQuery, { projection: { _id: 1 } }).toArray()

    loanCaseIdsToDelete = rows.map((r: any) => toIdString(r?._id)).filter(Boolean)
  }

  const res = await db.collection(collection).deleteMany(deleteQuery)

  if (collection === 'loanCases' && loanCaseIdsToDelete.length > 0) {
    await deleteAuditLogsForLoanCaseIds(db, loanCaseIdsToDelete, tenantId)
  }

  return { deleted: res.deletedCount || 0 }
}

export async function listDbMaintenanceTenants(): Promise<DbMaintenanceTenantInfo[]> {
  const { tenantId, tenantIdHex, tenantName } = await resolveDemoTenantForMaintenance()
  const db = await getDb()

  const doc =
    (await db.collection('tenants').findOne(
      { _id: tenantId },
      { projection: { _id: 1, name: 1, status: 1, type: 1, isDemo: 1 } }
    )) || null

  if (!doc) {
    return [
      {
        id: tenantIdHex,
        name: tenantName || tenantIdHex,
        status: 'active',
        type: 'company'
      }
    ]
  }

  return [
    {
      id: tenantIdHex,
      name: typeof (doc as any).name === 'string' ? (doc as any).name : tenantIdHex,
      status: typeof (doc as any).status === 'string' ? (doc as any).status : undefined,
      type: typeof (doc as any).type === 'string' ? (doc as any).type : undefined
    }
  ]
}

async function deleteByTenantId(collectionName: string, tenantId: ObjectId): Promise<number> {
  const db = await getDb()
  const exists = (await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray()).length > 0

  if (!exists) return 0

  const res = await db.collection(collectionName).deleteMany({ tenantId })

  return res.deletedCount || 0
}

export async function purgeTenantData(tenantIdRaw: string): Promise<DbMaintenanceTenantPurgeResult> {
  const { tenantId, tenantIdHex, tenantName: resolvedTenantName } = await resolveDemoTenantForMaintenance(tenantIdRaw)

  const db = await getDb()
  const tenantName = resolvedTenantName

  const membershipDocs = await db
    .collection('memberships')
    .find({ tenantId }, { projection: { userId: 1 } })
    .toArray()

  const tenantUserObjectIds = Array.from(
    new Set(
      membershipDocs
        .map(m => (m as any)?.userId)
        .filter((v: any) => v && typeof v === 'object' && typeof v.toHexString === 'function')
        .map((v: any) => v as ObjectId)
        .map(v => v.toHexString())
    )
  ).map(hex => new ObjectId(hex))

  const deletedByCollection: Record<string, number> = {}

  deletedByCollection.customers = await deleteByTenantId('customers', tenantId)
  deletedByCollection.associates = await deleteByTenantId('associates', tenantId)
  deletedByCollection.advocates = await deleteByTenantId('advocates', tenantId)
  deletedByCollection.banks = await deleteByTenantId('banks', tenantId)
  deletedByCollection.corporates = await deleteByTenantId('corporates', tenantId)
  deletedByCollection.loanTypes = await deleteByTenantId('loanTypes', tenantId)
  deletedByCollection.documentChecklists = await deleteByTenantId('documentChecklists', tenantId)
  deletedByCollection.loanStatusPipelineStages = await deleteByTenantId('loanStatusPipelineStages', tenantId)
  deletedByCollection.loanTypeDocuments = await deleteByTenantId('loanTypeDocuments', tenantId)
  deletedByCollection.loanCases = await deleteByTenantId('loanCases', tenantId)
  deletedByCollection.appointments = await deleteByTenantId('appointments', tenantId)
  deletedByCollection.loanDisbursementTrackers = await deleteByTenantId('loanDisbursementTrackers', tenantId)
  deletedByCollection.loanDisbursements = await deleteByTenantId('loanDisbursements', tenantId)

  const membershipsExists = (await db.listCollections({ name: 'memberships' }, { nameOnly: true }).toArray()).length > 0

  if (membershipsExists) {
    const mres = await db.collection('memberships').deleteMany({ tenantId })

    deletedByCollection.memberships = mres.deletedCount || 0
  } else {
    deletedByCollection.memberships = 0
  }

  const auditExists = (await db.listCollections({ name: 'auditLogs' }, { nameOnly: true }).toArray()).length > 0

  if (auditExists) {
    const ares = await db.collection('auditLogs').deleteMany({ targetTenantId: tenantId })

    deletedByCollection.auditLogs = ares.deletedCount || 0
  } else {
    deletedByCollection.auditLogs = 0
  }

  // Keep the demo tenant record so the organisation can be reused after purge.
  deletedByCollection.tenants = 0

  let deletedUsers = 0
  let keptSuperAdmins = 0
  let keptOtherTenants = 0

  if (tenantUserObjectIds.length > 0) {
    const usersExists = (await db.listCollections({ name: 'users' }, { nameOnly: true }).toArray()).length > 0

    if (usersExists) {
      const users = await db
        .collection('users')
        .find({ _id: { $in: tenantUserObjectIds } }, { projection: { _id: 1, isSuperAdmin: 1 } })
        .toArray()

      const superAdminIds = new Set(
        users
          .filter(u => Boolean((u as any).isSuperAdmin))
          .map(u => toIdString((u as any)._id))
          .filter(Boolean)
      )

      keptSuperAdmins = superAdminIds.size

      const nonSuperAdminIds = users
        .filter(u => !Boolean((u as any).isSuperAdmin))
        .map(u => (u as any)._id as ObjectId)

      if (nonSuperAdminIds.length > 0 && membershipsExists) {
        const otherMemberships = await db
          .collection('memberships')
          .find(
            {
              tenantId: { $ne: tenantId },
              userId: { $in: nonSuperAdminIds }
            },
            { projection: { userId: 1 } }
          )
          .toArray()

        const hasOtherTenant = new Set(
          otherMemberships
            .map(m => toIdString((m as any)?.userId))
            .filter(Boolean)
        )

        keptOtherTenants = hasOtherTenant.size

        const deletable = nonSuperAdminIds.filter(id => !hasOtherTenant.has(id.toHexString()))

        if (deletable.length > 0) {
          const authAccountsExists = (await db.listCollections({ name: 'authAccounts' }, { nameOnly: true }).toArray()).length > 0

          if (authAccountsExists) {
            await db.collection('authAccounts').deleteMany({ userId: { $in: deletable } })
          }

          const ures = await db.collection('users').deleteMany({ _id: { $in: deletable } })

          deletedUsers = ures.deletedCount || 0
        }
      }
    }
  }

  return {
    tenantId: tenantIdHex,
    tenantName,
    deletedByCollection,
    deletedUsers,
    keptUsers: {
      superAdmins: keptSuperAdmins,
      otherTenants: keptOtherTenants
    }
  }
}
