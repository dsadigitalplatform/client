import 'server-only'

import { ObjectId } from 'mongodb'

import type { DbMaintenanceDocumentPreview } from '../db-maintenance.types'

function toIdString(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'object' && v !== null && typeof (v as { toHexString?: () => string }).toHexString === 'function') {
    return (v as { toHexString: () => string }).toHexString()
  }

  return String(v)
}

function shortId(id: unknown): string {
  const s = toIdString(id)

  if (!s) return '—'
  if (s.length <= 10) return s

  return `${s.slice(0, 8)}…`
}

function formatDate(v: unknown): string {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(String(v))

  if (Number.isNaN(d.getTime())) return ''

  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatInr(v: unknown): string {
  const n = Number(v)

  if (!Number.isFinite(n)) return ''

  return `₹${n.toLocaleString('en-IN')}`
}

function compactJoin(parts: Array<string | null | undefined>, sep = ' • '): string {
  return parts.map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean).join(sep)
}

type NameMaps = {
  customers: Map<string, string>
  leads: Map<string, { customerName: string; bankName: string | null }>
  users: Map<string, string>
  stages: Map<string, string>
  loanTypes: Map<string, string>
}

async function loadNameMaps(db: any, collection: string, docs: any[]): Promise<NameMaps> {
  const maps: NameMaps = {
    customers: new Map(),
    leads: new Map(),
    users: new Map(),
    stages: new Map(),
    loanTypes: new Map()
  }

  const customerIds = new Set<string>()
  const leadIds = new Set<string>()
  const userIds = new Set<string>()
  const stageIds = new Set<string>()
  const loanTypeIds = new Set<string>()

  const needsCustomers = ['appointments', 'loanCases'].includes(collection)
  const needsLeads = ['appointments', 'loanDisbursements', 'loanDisbursementTrackers', 'auditLogs'].includes(collection)
  const needsUsers = ['memberships', 'loanCases', 'appointments'].includes(collection)
  const needsStages = collection === 'loanCases'
  const needsLoanTypes = collection === 'loanCases'

  docs.forEach(doc => {
    if (needsCustomers) customerIds.add(toIdString(doc.customerId))
    if (needsLeads) leadIds.add(toIdString(doc.leadId))
    if (collection === 'auditLogs') {
      const meta = doc.metadata || {}

      leadIds.add(toIdString(meta.leadId))
      customerIds.add(toIdString(meta.customerId))
    }
    if (needsUsers) {
      userIds.add(toIdString(doc.createdBy))
      userIds.add(toIdString(doc.userId))
      userIds.add(toIdString(doc.assignedAgentId))
      userIds.add(toIdString(doc.actorUserId))
      userIds.add(toIdString(doc.createdByUserId))
    }
    if (needsStages) stageIds.add(toIdString(doc.stageId))
    if (needsLoanTypes) loanTypeIds.add(toIdString(doc.loanTypeId))
  })

  const validObjectIds = (ids: Set<string>) =>
    Array.from(ids)
      .filter(id => ObjectId.isValid(id))
      .map(id => new ObjectId(id))

  const [customers, leads, users, stages, loanTypes] = await Promise.all([
    customerIds.size > 0
      ? db
          .collection('customers')
          .find({ _id: { $in: validObjectIds(customerIds) } }, { projection: { fullName: 1, name: 1, mobile: 1 } })
          .toArray()
      : [],
    leadIds.size > 0
      ? db
          .collection('loanCases')
          .find(
            { _id: { $in: validObjectIds(leadIds) } },
            { projection: { customerId: 1, bankName: 1, requestedAmount: 1, stageId: 1 } }
          )
          .toArray()
      : [],
    userIds.size > 0
      ? db.collection('users').find({ _id: { $in: validObjectIds(userIds) } }, { projection: { name: 1, email: 1 } }).toArray()
      : [],
    stageIds.size > 0
      ? db.collection('loanStatusPipelineStages').find({ _id: { $in: validObjectIds(stageIds) } }, { projection: { name: 1 } }).toArray()
      : [],
    loanTypeIds.size > 0
      ? db.collection('loanTypes').find({ _id: { $in: validObjectIds(loanTypeIds) } }, { projection: { name: 1 } }).toArray()
      : [],
  ])

  customers.forEach((row: any) => {
    const id = toIdString(row._id)
    const label = compactJoin([row.fullName, row.name, row.mobile ? `+${row.mobile}` : null])

    if (id && label) maps.customers.set(id, label)
  })

  const leadCustomerIds = new Set<string>()

  leads.forEach((row: any) => {
    const id = toIdString(row._id)
    const customerId = toIdString(row.customerId)

    if (customerId) leadCustomerIds.add(customerId)
    maps.leads.set(id, { customerName: '', bankName: row.bankName ?? null })
  })

  if (leadCustomerIds.size > 0) {
    const extraCustomers = await db
      .collection('customers')
      .find({ _id: { $in: validObjectIds(leadCustomerIds) } }, { projection: { fullName: 1, name: 1 } })
      .toArray()

    extraCustomers.forEach((row: any) => {
      const id = toIdString(row._id)
      const label = compactJoin([row.fullName, row.name])

      if (id && label) maps.customers.set(id, label)
    })
  }

  leads.forEach((row: any) => {
    const id = toIdString(row._id)
    const entry = maps.leads.get(id)

    if (!entry) return
    const customerName = maps.customers.get(toIdString(row.customerId)) || ''

    maps.leads.set(id, { ...entry, customerName })
  })

  users.forEach((row: any) => {
    const id = toIdString(row._id)
    const label = compactJoin([row.name, row.email])

    if (id && label) maps.users.set(id, label)
  })

  stages.forEach((row: any) => {
    const id = toIdString(row._id)

    if (id && row.name) maps.stages.set(id, String(row.name))
  })

  loanTypes.forEach((row: any) => {
    const id = toIdString(row._id)

    if (id && row.name) maps.loanTypes.set(id, String(row.name))
  })

  return maps
}

function getProjectionForCollection(collection: string): Record<string, 1> {
  const common = { _id: 1, createdAt: 1, updatedAt: 1, tenantId: 1, createdBy: 1 } as const

  switch (collection) {
    case 'appointments':
      return {
        ...common,
        scheduledAt: 1,
        status: 1,
        followUpType: 1,
        leadId: 1,
        customerId: 1,
        durationMinutes: 1,
        outcomeComments: 1
      }
    case 'loanDisbursements':
      return {
        ...common,
        amount: 1,
        disbursedDate: 1,
        reason: 1,
        bankReference: 1,
        leadId: 1,
        trackerId: 1,
        createdByUserId: 1,
        createdByName: 1
      }
    case 'loanDisbursementTrackers':
      return {
        ...common,
        leadId: 1,
        approvedAmount: 1,
        totalDisbursedAmount: 1,
        remainingAmount: 1,
        disbursementStatus: 1,
        createdByUserId: 1,
        createdByName: 1
      }
    case 'loanCases':
      return {
        ...common,
        customerId: 1,
        loanTypeId: 1,
        stageId: 1,
        bankName: 1,
        requestedAmount: 1,
        approvedAmount: 1,
        assignedAgentId: 1,
        isActive: 1
      }
    case 'auditLogs':
      return { ...common, action: 1, actorUserId: 1, targetTenantId: 1, metadata: 1 }
    case 'memberships':
      return { ...common, userId: 1, role: 1, status: 1 }
    case 'authAccounts':
      return { ...common, userId: 1, provider: 1, providerAccountId: 1 }
    case 'subscriptionPlans':
      return { ...common, name: 1, slug: 1, status: 1, price: 1 }
    case 'loanTypeDocuments':
      return { ...common, loanTypeId: 1, documentId: 1, status: 1 }
    default:
      return {
        ...common,
        email: 1,
        name: 1,
        fullName: 1,
        associateName: 1,
        companyName: 1,
        mobile: 1,
        slug: 1,
        code: 1,
        status: 1,
        role: 1,
        type: 1,
        isActive: 1,
        action: 1,
        description: 1
      }
  }
}

function buildPreview(collection: string, doc: any, maps: NameMaps): DbMaintenanceDocumentPreview {
  const id = toIdString(doc._id)
  const meta = doc.metadata || {}
  let title = ''
  const details: string[] = []

  switch (collection) {
    case 'appointments': {
      const customer = maps.customers.get(toIdString(doc.customerId))
      const lead = maps.leads.get(toIdString(doc.leadId))

      title = compactJoin([
        doc.followUpType ? String(doc.followUpType).replace(/_/g, ' ') : 'Appointment',
        doc.status ? String(doc.status) : null
      ])
      if (customer) details.push(`Customer: ${customer}`)
      if (lead?.customerName && lead.customerName !== customer) details.push(`Lead customer: ${lead.customerName}`)
      const when = formatDate(doc.scheduledAt)

      if (when) details.push(`Scheduled: ${when}`)
      if (doc.durationMinutes) details.push(`Duration: ${doc.durationMinutes} min`)
      details.push(`Lead: ${shortId(doc.leadId)}`)
      break
    }
    case 'loanDisbursements': {
      const lead = maps.leads.get(toIdString(doc.leadId))

      title = compactJoin([formatInr(doc.amount), doc.disbursedDate ? `on ${formatDate(doc.disbursedDate)}` : null], ' ')
      if (lead?.customerName) details.push(`Customer: ${lead.customerName}`)
      if (doc.reason) details.push(`Reason: ${String(doc.reason)}`)
      if (doc.bankReference) details.push(`Bank ref: ${String(doc.bankReference)}`)
      if (doc.createdByName) details.push(`Recorded by: ${String(doc.createdByName)}`)
      details.push(`Lead: ${shortId(doc.leadId)}`, `Tracker: ${shortId(doc.trackerId)}`)
      break
    }
    case 'loanDisbursementTrackers': {
      const lead = maps.leads.get(toIdString(doc.leadId))

      title = compactJoin([
        doc.disbursementStatus ? String(doc.disbursementStatus) : 'Tracker',
        doc.approvedAmount != null ? `${formatInr(doc.approvedAmount)} approved` : null
      ])
      if (lead?.customerName) details.push(`Customer: ${lead.customerName}`)
      if (doc.totalDisbursedAmount != null) details.push(`Disbursed: ${formatInr(doc.totalDisbursedAmount)}`)
      if (doc.remainingAmount != null) details.push(`Remaining: ${formatInr(doc.remainingAmount)}`)
      if (doc.createdByName) details.push(`Started by: ${String(doc.createdByName)}`)
      details.push(`Lead: ${shortId(doc.leadId)}`)
      break
    }
    case 'loanCases': {
      const customer = maps.customers.get(toIdString(doc.customerId))
      const stage = maps.stages.get(toIdString(doc.stageId))
      const loanType = maps.loanTypes.get(toIdString(doc.loanTypeId))
      const agent = maps.users.get(toIdString(doc.assignedAgentId))

      title = customer || `Lead ${shortId(id)}`
      if (loanType) details.push(`Loan type: ${loanType}`)
      if (stage) details.push(`Stage: ${stage}`)
      if (doc.bankName) details.push(`Bank: ${String(doc.bankName)}`)
      if (doc.requestedAmount != null) details.push(`Requested: ${formatInr(doc.requestedAmount)}`)
      if (agent) details.push(`Agent: ${agent}`)
      if (doc.isActive === false) details.push('Status: Inactive')
      break
    }
    case 'auditLogs': {
      title = doc.action ? String(doc.action).replace(/_/g, ' ') : 'Audit entry'
      const customerName = meta.customerName || maps.customers.get(toIdString(meta.customerId))
      const lead = maps.leads.get(toIdString(meta.leadId))

      if (customerName) details.push(`Customer: ${String(customerName)}`)
      else if (lead?.customerName) details.push(`Customer: ${lead.customerName}`)
      if (meta.toStageName) details.push(`To stage: ${String(meta.toStageName)}`)
      else if (meta.stageName) details.push(`Stage: ${String(meta.stageName)}`)
      if (meta.leadId) details.push(`Lead: ${shortId(meta.leadId)}`)
      const actor = maps.users.get(toIdString(doc.actorUserId))

      if (actor) details.push(`Actor: ${actor}`)
      const when = formatDate(doc.createdAt)

      if (when) details.push(`When: ${when}`)
      break
    }
    case 'memberships': {
      const user = maps.users.get(toIdString(doc.userId))

      title = compactJoin([doc.role, doc.status])
      if (user) details.push(`User: ${user}`)
      details.push(`Tenant: ${shortId(doc.tenantId)}`, `User id: ${shortId(doc.userId)}`)
      break
    }
    case 'authAccounts': {
      title = compactJoin([doc.provider, doc.providerAccountId ? `…${String(doc.providerAccountId).slice(-6)}` : null])
      const user = maps.users.get(toIdString(doc.userId))

      if (user) details.push(`User: ${user}`)
      details.push(`User id: ${shortId(doc.userId)}`)
      break
    }
    case 'loanTypeDocuments': {
      title = compactJoin(['Mapping', doc.status])
      details.push(`Loan type: ${shortId(doc.loanTypeId)}`, `Document: ${shortId(doc.documentId)}`)
      break
    }
    default: {
      title = compactJoin([
        doc.fullName,
        doc.name,
        doc.associateName,
        doc.companyName,
        doc.email,
        doc.mobile,
        doc.code,
        doc.slug,
        doc.status,
        doc.role,
        doc.type
      ])
      if (!title) title = `Record ${shortId(id)}`
    }
  }

  const created = formatDate(doc.createdAt)

  if (created && !details.some(d => d.startsWith('When:') || d.startsWith('Scheduled:'))) {
    details.push(`Created: ${created}`)
  }

  const uniqueDetails = Array.from(new Set(details.filter(Boolean)))

  return {
    id,
    title,
    summary: uniqueDetails.length > 0 ? `${title} — ${uniqueDetails[0]}` : title,
    details: uniqueDetails
  }
}

export async function buildDbMaintenanceDocumentPreviews(
  db: any,
  collection: string,
  docs: any[]
): Promise<DbMaintenanceDocumentPreview[]> {
  if (docs.length === 0) return []

  const maps = await loadNameMaps(db, collection, docs)

  return docs.map(doc => buildPreview(collection, doc, maps))
}

export function getDbMaintenanceDocumentProjection(collection: string): Record<string, 1> {
  return getProjectionForCollection(collection)
}
