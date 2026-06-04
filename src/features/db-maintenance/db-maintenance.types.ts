/** Groups hidden from the DB maintenance screen (e.g. Platform for demo tenant). */
export const DB_MAINTENANCE_UI_HIDDEN_GROUPS = ['Platform'] as const

/** Platform collections — not deletable via DB maintenance (demo tenant only). */
export const DB_MAINTENANCE_DELETE_BLOCKED_COLLECTIONS = [
  'users',
  'authAccounts',
  'subscriptionPlans',
  'tenants'
] as const

export function isDbMaintenanceCollectionDeletable(collection: string): boolean {
  return !(DB_MAINTENANCE_DELETE_BLOCKED_COLLECTIONS as readonly string[]).includes(collection)
}

export type DbMaintenanceCollectionInfo = {
  name: string
  label: string
  group: string
  exists: boolean
  documentCount: number
  deletable: boolean
}

export const DB_MAINTENANCE_CREATOR_FILTER_COLLECTIONS = [
  'customers',
  'associates',
  'advocates',
  'banks',
  'corporates',
  'loanCases',
  'appointments'
] as const

export type DbMaintenanceClearResult = {
  name: string
  before: number
  deleted: number
  after: number
}

export type DbMaintenanceDocumentPreview = {
  id: string
  /** Primary label — use this in the records list. */
  title: string
  /** Backward-compatible one-line summary. */
  summary: string
  /** Extra identifying lines (customer, dates, amounts, refs). */
  details: string[]
}

export type DbMaintenanceCreatorOption = {
  id: string
  name: string
  email: string | null
  documentCount: number
}

export type DbMaintenanceTenantInfo = {
  id: string
  name: string
  status?: string
  type?: string
}

export type DbMaintenanceTenantPurgeResult = {
  tenantId: string
  tenantName: string | null
  deletedByCollection: Record<string, number>
  deletedUsers: number
  keptUsers: {
    superAdmins: number
    otherTenants: number
  }
}
