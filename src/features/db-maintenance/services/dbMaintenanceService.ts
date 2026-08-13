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
  list: (tenantId: string) =>
    api<{ collections: DbMaintenanceCollectionInfo[] }>(
      `/api/super-admin/db-maintenance?tenantId=${encodeURIComponent(tenantId)}`
    ),
  clear: (collection: string, tenantId: string) =>
    api<{ result: DbMaintenanceClearResult }>('/api/super-admin/db-maintenance', {
      method: 'POST',
      body: JSON.stringify({ collection, tenantId })
    }),
  listTenants: () => api<{ tenants: DbMaintenanceTenantInfo[] }>('/api/super-admin/db-maintenance/tenants'),
  purgeTenant: (tenantId: string, options?: { deleteTenant?: boolean }) =>
    api<{ result: DbMaintenanceTenantPurgeResult }>('/api/super-admin/db-maintenance/tenant-purge', {
      method: 'POST',
      body: JSON.stringify({ tenantId, deleteTenant: Boolean(options?.deleteTenant) })
    }),
  listDocuments: (
    collection: string,
    params: { tenantId: string; limit?: number; cursor?: string | null; createdById?: string | null }
  ) => {
    const qs = new URLSearchParams()

    qs.set('tenantId', params.tenantId)
    if (params.limit != null) qs.set('limit', String(params.limit))
    if (params.cursor) qs.set('cursor', String(params.cursor))
    if (params.createdById) qs.set('createdById', String(params.createdById))

    return api<{ items: DbMaintenanceDocumentPreview[]; nextCursor: string | null }>(
      `/api/super-admin/db-maintenance/${encodeURIComponent(collection)}?${qs.toString()}`
    )
  },
  listCreators: (collection: string, tenantId: string) =>
    api<{ creators: DbMaintenanceCreatorOption[] }>(
      `/api/super-admin/db-maintenance/${encodeURIComponent(collection)}/creators?tenantId=${encodeURIComponent(tenantId)}`
    ),
  deleteDocuments: (
    collection: string,
    ids: string[],
    options: { tenantId: string; createdById?: string | null }
  ) =>
    api<{ deleted: number }>(`/api/super-admin/db-maintenance/${encodeURIComponent(collection)}`, {
      method: 'POST',
      body: JSON.stringify({
        ids,
        tenantId: options.tenantId,
        createdById: options.createdById || null
      })
    })
}
