import type { ReportBreakdownRow, ReportDetailRow, ReportGroupBy, ReportSummary, ReportTrendRow } from '../reports.types'
import type { DisbursementActivityLeadRow } from './disbursementActivityReport.server'
import { resolveMergedLeadAmount } from './disbursementActivityReport.server'
import { mapReportDisbursementFields } from '../utils/reportDisbursement'
import { resolveReportLeadAmount } from '../utils/reportLeadAmount'

type HistoricalReportSlice = {
  summary: ReportSummary
  breakdown: ReportBreakdownRow[]
  trend: ReportTrendRow[]
  details: ReportDetailRow[]
}

function formatDisbursedDate(isoDate: string | null | undefined) {
  if (!isoDate) return null

  return isoDate.length >= 10 ? isoDate.slice(0, 10) : isoDate
}

function buildDetailFromDisbursement(row: DisbursementActivityLeadRow): ReportDetailRow {
  const leadAmount = resolveReportLeadAmount({
    approvedAmount: row.approvedAmount,
    requestedAmount: row.requestedAmount
  })

  return {
    leadId: row.leadId,
    leadCode: row.leadCode,
    customerName: row.customerName,
    loanTypeName: row.loanTypeName,
    bankName: row.bankName,
    stageName: row.stageName,
    agentName: row.agentName,
    requestedAmount: resolveMergedLeadAmount(row.periodDisbursedAmount, leadAmount),
    createdAt: row.createdAt,
    auditStagedDate: row.lastDisbursedDate || null,
    auditStageName: row.stageName ? `${row.stageName} (disbursement)` : 'Progressive disbursement',
    ...mapReportDisbursementFields(row.disbursementTracker)
  }
}

function dedupeHistoricalDetails(details: ReportDetailRow[]) {
  const byLead = new Map<string, ReportDetailRow>()

  for (const row of details) {
    if (!byLead.has(row.leadId)) byLead.set(row.leadId, row)
  }

  return Array.from(byLead.values())
}

function mergeDetailRows(
  historicalDetails: ReportDetailRow[],
  disbursementLeads: DisbursementActivityLeadRow[]
): ReportDetailRow[] {
  const byLead = new Map<string, ReportDetailRow>()

  for (const row of dedupeHistoricalDetails(historicalDetails)) {
    byLead.set(row.leadId, { ...row })
  }

  for (const disbursementLead of disbursementLeads) {
    const existing = byLead.get(disbursementLead.leadId)
    const leadAmount = resolveReportLeadAmount({
      approvedAmount: disbursementLead.approvedAmount,
      requestedAmount: disbursementLead.requestedAmount
    })

    if (existing) {
      byLead.set(disbursementLead.leadId, {
        ...existing,
        requestedAmount: resolveMergedLeadAmount(disbursementLead.periodDisbursedAmount, leadAmount),
        stageName: existing.stageName || disbursementLead.stageName,
        ...mapReportDisbursementFields(disbursementLead.disbursementTracker)
      })
    } else {
      byLead.set(disbursementLead.leadId, buildDetailFromDisbursement(disbursementLead))
    }
  }

  return Array.from(byLead.values()).sort((a, b) => {
    const aDate = a.auditStagedDate || ''
    const bDate = b.auditStagedDate || ''

    return bDate.localeCompare(aDate)
  })
}

function resolveGroupKey(row: ReportDetailRow, disbursementLead: DisbursementActivityLeadRow | undefined, groupBy: ReportGroupBy) {
  switch (groupBy) {
    case 'agent':
      return disbursementLead?.assignedAgentId || 'unassigned'
    case 'customer':
      return disbursementLead?.customerId || 'unknown'
    case 'bank':
      return row.bankName || 'Unassigned'
    case 'loanType':
      return disbursementLead?.loanTypeId || 'unknown'
    case 'stage':
      return row.auditStageName || row.stageName || 'Unknown stage'
    case 'time':
      return formatDisbursedDate(row.auditStagedDate) || 'unknown'
    default:
      return row.leadId
  }
}

function resolveGroupLabel(key: string, row: ReportDetailRow, groupBy: ReportGroupBy) {
  switch (groupBy) {
    case 'agent':
      return row.agentName || 'Unassigned'
    case 'customer':
      return row.customerName || 'Unknown'
    case 'bank':
      return row.bankName || 'Unassigned'
    case 'loanType':
      return row.loanTypeName || 'Unknown'
    case 'stage':
      return row.auditStageName || row.stageName || 'Unknown stage'
    case 'time':
      return key
    default:
      return key
  }
}

function buildBreakdown(details: ReportDetailRow[], disbursementByLead: Map<string, DisbursementActivityLeadRow>, groupBy: ReportGroupBy) {
  const buckets = new Map<string, ReportBreakdownRow>()

  for (const row of details) {
    const disbursementLead = disbursementByLead.get(row.leadId)
    const key = resolveGroupKey(row, disbursementLead, groupBy)
    const label = resolveGroupLabel(key, row, groupBy)
    const amount = row.requestedAmount ?? 0
    const existing = buckets.get(key)

    if (existing) {
      existing.count += 1
      existing.amount += amount
    } else {
      buckets.set(key, { key, label, count: 1, amount, order: null })
    }
  }

  return Array.from(buckets.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

function buildTrend(details: ReportDetailRow[]) {
  const buckets = new Map<string, ReportTrendRow>()

  for (const row of details) {
    const label = formatDisbursedDate(row.auditStagedDate)

    if (!label) continue

    const amount = row.requestedAmount ?? 0
    const existing = buckets.get(label)

    if (existing) {
      existing.count += 1
      existing.amount += amount
    } else {
      buckets.set(label, { label, periodStart: label, count: 1, amount })
    }
  }

  return Array.from(buckets.values()).sort((a, b) => a.label.localeCompare(b.label))
}

function buildSummary(details: ReportDetailRow[]): ReportSummary {
  const customers = new Set<string>()

  for (const row of details) {
    if (row.customerName) customers.add(row.customerName)
  }

  return {
    totalCases: details.length,
    totalAmount: details.reduce((sum, row) => sum + (row.requestedAmount ?? 0), 0),
    uniqueCustomers: customers.size
  }
}

export function mergeHistoricalWithDisbursementActivity(
  historical: HistoricalReportSlice,
  disbursementLeads: DisbursementActivityLeadRow[],
  groupBy: ReportGroupBy
): HistoricalReportSlice {
  if (disbursementLeads.length === 0) return historical

  const disbursementByLead = new Map(disbursementLeads.map(lead => [lead.leadId, lead]))
  const details = mergeDetailRows(historical.details, disbursementLeads)
  const summary = buildSummary(details)
  const breakdown = buildBreakdown(details, disbursementByLead, groupBy)
  const trend = buildTrend(details)

  return { summary, breakdown, trend, details }
}
