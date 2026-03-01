export type DbMaintenanceCollectionInfo = {
  name: string
  exists: boolean
  documentCount: number
}

export type DbMaintenanceClearResult = {
  name: string
  before: number
  deleted: number
  after: number
}

export type DbMaintenanceDocumentPreview = {
  id: string
  summary: string
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
