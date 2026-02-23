export type GetDocumentChecklistsParams = { q?: string }

export type CreateDocumentChecklistInput = {
  name: string
  description?: string | null
  isActive?: boolean
}

export async function getDocumentChecklists(params: GetDocumentChecklistsParams = {}) {
  const url = new URL('/api/document-checklists', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.q) url.searchParams.set('q', params.q)
  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch document checklists (${res.status})`)
  }

  const data = await res.json()

  return (data?.documents ?? []) as any
}

export async function createDocumentChecklist(body: CreateDocumentChecklistInput) {
  const res = await fetch('/api/document-checklists', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create document checklist'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data
}

export async function getDocumentChecklist(id: string) {
  const res = await fetch(`/api/document-checklists/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch document checklist')

  return res.json()
}

export async function updateDocumentChecklist(id: string, body: Partial<CreateDocumentChecklistInput>) {
  const res = await fetch(`/api/document-checklists/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update document checklist') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data
}

export async function deleteDocumentChecklist(id: string) {
  const res = await fetch(`/api/document-checklists/${id}`, { method: 'DELETE' })

  if (!res.ok) throw new Error('Failed to delete document checklist')

  return res.json()
}
