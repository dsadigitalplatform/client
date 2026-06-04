export type DbMaintenanceCollectionInfo = {
  name: string
  label: string
  group: string
  exists: boolean
  documentCount: number
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
