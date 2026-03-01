import type {
  CreateLoanCaseInput,
  LoanCaseDetails,
  LoanCaseDocument,
  LoanCaseListItem,
  TenantUserOption,
  UpdateLoanCaseInput
} from '@features/loan-cases/loan-cases.types'

export type GetLoanCasesParams = { stageId?: string; assignedAgentId?: string; customerId?: string }

export async function getLoanCases(params: GetLoanCasesParams = {}) {
  const url = new URL('/api/loan-cases', typeof window === 'undefined' ? 'http://localhost' : window.location.origin)

  if (params.stageId) url.searchParams.set('stageId', params.stageId)
  if (params.assignedAgentId) url.searchParams.set('assignedAgentId', params.assignedAgentId)
  if (params.customerId) url.searchParams.set('customerId', params.customerId)

  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch loan cases (${res.status})`)
  }

  const data = await res.json()

  return (data?.cases ?? []) as LoanCaseListItem[]
}

export async function getLoanCaseById(id: string) {
  const res = await fetch(`/api/loan-cases/${id}`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch loan case')

  return (await res.json()) as LoanCaseDetails
}

export async function createLoanCase(body: CreateLoanCaseInput) {
  const res = await fetch('/api/loan-cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to create loan case'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data as { id: string }
}

export async function updateLoanCase(id: string, body: UpdateLoanCaseInput) {
  const res = await fetch(`/api/loan-cases/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to update loan case'
    const details = data?.details
    const err = new Error(message) as any

    if (details) err.details = details
    throw err
  }

  return data as { ok: true }
}

export async function updateCaseStage(caseId: string, newStageId: string) {
  const res = await fetch(`/api/loan-cases/${caseId}/stage`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ newStageId })
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || 'Failed to update case stage'
    const err = new Error(message) as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data as { ok: true; updatedAt?: string }
}

export async function getChecklistByLoanType(loanTypeId: string) {
  const res = await fetch(`/api/loan-types/${loanTypeId}/documents`, { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch document checklist')

  const data = await res.json()
  const documents = Array.isArray(data?.documents) ? data.documents : []
  const mappings = Array.isArray(data?.mappings) ? data.mappings : []

  const enabledDocIds = new Set<string>()

  mappings.forEach((m: any) => {
    const documentId = String(m?.documentId || '')
    const status = String(m?.status || '')

    if (!documentId) return
    if (status === 'REQUIRED' || status === 'OPTIONAL') enabledDocIds.add(documentId)
  })

  const checklist: LoanCaseDocument[] = documents
    .filter((d: any) => enabledDocIds.has(String(d?.id || '')))
    .map((d: any) => ({
      documentId: String(d?.id || ''),
      documentName: String(d?.name || ''),
      status: 'PENDING'
    }))
    .filter((d: LoanCaseDocument) => d.documentId.length > 0 && d.documentName.length > 0)
    .sort((a: LoanCaseDocument, b: LoanCaseDocument) => a.documentName.localeCompare(b.documentName))

  return checklist
}

export async function getTenantUsers() {
  const res = await fetch('/api/tenant-users', { cache: 'no-store' })

  if (!res.ok) throw new Error('Failed to fetch tenant users')

  const data = await res.json().catch(() => ({}))

  return (data?.users ?? []) as TenantUserOption[]
}
