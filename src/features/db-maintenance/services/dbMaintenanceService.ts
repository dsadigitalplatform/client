import type {
  DbMaintenanceClearResult,
  DbMaintenanceCollectionInfo,
  DbMaintenanceCreatorOption,
  DbMaintenanceDocumentPreview,
  DbMaintenanceTenantInfo,
  DbMaintenanceTenantPurgeResult
} from '../db-maintenance.types'

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {})
    }
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))

    throw new Error(err?.error || 'request_failed')
  }

  return res.json()
}

export const dbMaintenanceService = {
  list: () => api<{ collections: DbMaintenanceCollectionInfo[] }>('/api/super-admin/db-maintenance'),
  clear: (collection: string) =>
    api<{ result: DbMaintenanceClearResult }>('/api/super-admin/db-maintenance', {
      method: 'POST',
      body: JSON.stringify({ collection })
    }),
  listTenants: () => api<{ tenants: DbMaintenanceTenantInfo[] }>('/api/super-admin/db-maintenance/tenants'),
  purgeTenant: (tenantId: string) =>
    api<{ result: DbMaintenanceTenantPurgeResult }>('/api/super-admin/db-maintenance/tenant-purge', {
      method: 'POST',
      body: JSON.stringify({ tenantId })
    }),
  listDocuments: (collection: string, params?: { limit?: number; cursor?: string | null; createdById?: string | null }) => {
    const qs = new URLSearchParams()

    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.cursor) qs.set('cursor', String(params.cursor))
    if (params?.createdById) qs.set('createdById', String(params.createdById))

    const suffix = qs.toString() ? `?${qs.toString()}` : ''

    return api<{ items: DbMaintenanceDocumentPreview[]; nextCursor: string | null }>(
      `/api/super-admin/db-maintenance/${encodeURIComponent(collection)}${suffix}`
    )
  },
  listCreators: (collection: string) =>
    api<{ creators: DbMaintenanceCreatorOption[] }>(`/api/super-admin/db-maintenance/${encodeURIComponent(collection)}/creators`),
  deleteDocuments: (collection: string, ids: string[], options?: { createdById?: string | null }) =>
    api<{ deleted: number }>(`/api/super-admin/db-maintenance/${encodeURIComponent(collection)}`, {
      method: 'POST',
      body: JSON.stringify({ ids, createdById: options?.createdById || null })
    })
}
