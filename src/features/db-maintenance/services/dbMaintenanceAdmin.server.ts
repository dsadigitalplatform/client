import 'server-only'

import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'

import type {
  DbMaintenanceClearResult,
  DbMaintenanceCollectionInfo,
  DbMaintenanceDocumentPreview,
  DbMaintenanceTenantInfo,
  DbMaintenanceTenantPurgeResult
} from '../db-maintenance.types'

export const DB_MAINTENANCE_COLLECTIONS = [
  'users',
  'authAccounts',
  'tenants',
  'memberships',
  'auditLogs',
  'subscriptionPlans',
  'customers',
  'loanTypes',
  'documentChecklists',
  'loanStatusPipelineStages',
  'loanTypeDocuments',
  'loanCases'
] as const

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

  for (const name of DB_MAINTENANCE_COLLECTIONS) {
    const exists = (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0
    const documentCount = exists ? await db.collection(name).countDocuments({}) : 0

    out.push({ name, exists, documentCount })
  }

  return out
}

export async function clearDbMaintenanceCollection(name: string): Promise<DbMaintenanceClearResult> {
  const db = await getDb()

  const exists = (await db.listCollections({ name }, { nameOnly: true }).toArray()).length > 0

  if (!exists) {
    return { name, before: 0, deleted: 0, after: 0 }
  }

  const coll = db.collection(name)
  const before = await coll.countDocuments({})
  const del = await coll.deleteMany({})
  const after = await coll.countDocuments({})

  return { name, before, deleted: del.deletedCount || 0, after }
}

function toIdString(v: any): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v?.toHexString === 'function') return v.toHexString()

  return String(v)
}

function buildSummary(doc: any): string {
  if (!doc || typeof doc !== 'object') return ''

  const candidates = [
    doc.email,
    doc.name,
    doc.fullName,
    doc.mobile,
    doc.slug,
    doc.code,
    doc.status,
    doc.role,
    doc.type
  ]
    .map(v => (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? String(v) : ''))
    .map(s => s.trim())
    .filter(Boolean)

  if (candidates.length > 0) return candidates.slice(0, 3).join(' • ')

  const keys = Object.keys(doc)
    .filter(k => k !== '_id')
    .slice(0, 6)

  if (keys.length === 0) return ''

  const parts = keys.map(k => {
    const v = (doc as any)[k]

    if (typeof v === 'string') return `${k}: ${v.length > 32 ? `${v.slice(0, 32)}…` : v}`
    if (typeof v === 'number' || typeof v === 'boolean') return `${k}: ${String(v)}`
    if (v && typeof v === 'object' && typeof (v as any).toHexString === 'function') return `${k}: ${(v as any).toHexString()}`
    if (v instanceof Date) return `${k}: ${v.toISOString()}`

    return `${k}: …`
  })

  return parts.join(' • ')
}

export async function listDbMaintenanceDocuments(params: {
  collection: string
  limit?: number
  cursor?: string | null
}): Promise<{ items: DbMaintenanceDocumentPreview[]; nextCursor: string | null }> {
  const db = await getDb()
  const collection = params.collection
  const limitRaw = typeof params.limit === 'number' ? params.limit : 50
  const limit = Math.max(1, Math.min(200, Math.floor(limitRaw)))

  const exists = (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0

  if (!exists) {
    return { items: [], nextCursor: null }
  }

  const query: any = {}

  if (params.cursor && typeof params.cursor === 'string' && params.cursor.trim().length > 0) {
    const c = params.cursor.trim()

    if (ObjectId.isValid(c)) query._id = { $lt: new ObjectId(c) }
  }

  const docs = await db
    .collection(collection)
    .find(query, { projection: { _id: 1, email: 1, name: 1, fullName: 1, mobile: 1, slug: 1, code: 1, status: 1, role: 1, type: 1, createdAt: 1 } })
    .sort({ _id: -1 })
    .limit(limit)
    .toArray()

  const items: DbMaintenanceDocumentPreview[] = docs.map(d => ({
    id: toIdString((d as any)._id),
    summary: buildSummary(d)
  }))

  const last = docs.length > 0 ? docs[docs.length - 1] : null
  const nextCursor = last && typeof (last as any)?._id?.toHexString === 'function' ? (last as any)._id.toHexString() : null

  return { items, nextCursor }
}

export async function deleteDbMaintenanceDocuments(params: { collection: string; ids: string[] }): Promise<{ deleted: number }> {
  const db = await getDb()
  const collection = params.collection
  const ids = Array.isArray(params.ids) ? params.ids : []

  const unique = Array.from(new Set(ids.map(s => String(s || '').trim()).filter(Boolean))).slice(0, 500)

  if (unique.length === 0) return { deleted: 0 }

  const exist = (await db.listCollections({ name: collection }, { nameOnly: true }).toArray()).length > 0

  if (!exist) return { deleted: 0 }

  const ors: any[] = []

  for (const id of unique) {
    if (ObjectId.isValid(id)) ors.push({ _id: new ObjectId(id) })
    ors.push({ _id: id })
  }

  const res = await db.collection(collection).deleteMany({ $or: ors })

  return { deleted: res.deletedCount || 0 }
}

export async function listDbMaintenanceTenants(): Promise<DbMaintenanceTenantInfo[]> {
  const db = await getDb()

  const docs = await db
    .collection('tenants')
    .find(
      {},
      {
        projection: { _id: 1, name: 1, status: 1, type: 1 }
      }
    )
    .sort({ name: 1 })
    .limit(500)
    .toArray()

  return docs.map(d => ({
    id: toIdString((d as any)._id),
    name: typeof (d as any).name === 'string' ? (d as any).name : toIdString((d as any)._id),
    status: typeof (d as any).status === 'string' ? (d as any).status : undefined,
    type: typeof (d as any).type === 'string' ? (d as any).type : undefined
  }))
}

async function deleteByTenantId(collectionName: string, tenantId: ObjectId): Promise<number> {
  const db = await getDb()
  const exists = (await db.listCollections({ name: collectionName }, { nameOnly: true }).toArray()).length > 0

  if (!exists) return 0

  const res = await db.collection(collectionName).deleteMany({ tenantId })

  return res.deletedCount || 0
}

export async function purgeTenantData(tenantIdRaw: string): Promise<DbMaintenanceTenantPurgeResult> {
  if (!ObjectId.isValid(tenantIdRaw)) {
    throw new Error('invalid_tenant_id')
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)

  const tenant = await db.collection('tenants').findOne({ _id: tenantId }, { projection: { name: 1 } })
  const tenantName = tenant && typeof (tenant as any).name === 'string' ? (tenant as any).name : null

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
  deletedByCollection.loanTypes = await deleteByTenantId('loanTypes', tenantId)
  deletedByCollection.documentChecklists = await deleteByTenantId('documentChecklists', tenantId)
  deletedByCollection.loanStatusPipelineStages = await deleteByTenantId('loanStatusPipelineStages', tenantId)
  deletedByCollection.loanTypeDocuments = await deleteByTenantId('loanTypeDocuments', tenantId)
  deletedByCollection.loanCases = await deleteByTenantId('loanCases', tenantId)

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

  const tenantExists = (await db.listCollections({ name: 'tenants' }, { nameOnly: true }).toArray()).length > 0

  if (tenantExists) {
    const tres = await db.collection('tenants').deleteOne({ _id: tenantId })

    deletedByCollection.tenants = (tres.deletedCount as number) || 0
  } else {
    deletedByCollection.tenants = 0
  }

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
    tenantId: tenantIdRaw,
    tenantName,
    deletedByCollection,
    deletedUsers,
    keptUsers: {
      superAdmins: keptSuperAdmins,
      otherTenants: keptOtherTenants
    }
  }
}
