import { ObjectId, type Db } from 'mongodb'

import { getHistoricalStageLeadAmountsInRange } from '@features/reports/server/historicalStageSummary.server'
import {
  getDisbursementActivityLeadsInRange,
  resolveMergedLeadAmount
} from '@features/reports/server/disbursementActivityReport.server'
import { resolveReportLeadAmount } from '@features/reports/utils/reportLeadAmount'

export async function getMergedMonthlyDisbursedSummary(
  db: Db,
  tenantIdObj: ObjectId,
  tenantIdHex: string,
  userId: ObjectId,
  role: 'OWNER' | 'ADMIN' | 'USER',
  disbursedStageId: string | null,
  dateFrom: string,
  dateTo: string,
  assignedAgentId?: string | null
) {
  const [stageLeadAmounts, disbursementLeads] = await Promise.all([
    disbursedStageId
      ? getHistoricalStageLeadAmountsInRange(
          db,
          tenantIdObj,
          tenantIdHex,
          userId,
          role,
          disbursedStageId,
          dateFrom,
          dateTo,
          assignedAgentId
        )
      : Promise.resolve(new Map<string, number>()),
    getDisbursementActivityLeadsInRange(db, tenantIdObj, tenantIdHex, userId, role, dateFrom, dateTo, {
      assignedAgentId
    })
  ])

  const mergedAmounts = new Map<string, number>(stageLeadAmounts)

  for (const lead of disbursementLeads) {
    const stageAmount = mergedAmounts.get(lead.leadId)
    const leadAmount = resolveReportLeadAmount({
      approvedAmount: lead.approvedAmount,
      requestedAmount: lead.requestedAmount
    })

    mergedAmounts.set(
      lead.leadId,
      resolveMergedLeadAmount(lead.periodDisbursedAmount, stageAmount ?? leadAmount)
    )
  }

  return {
    totalCases: mergedAmounts.size,
    totalAmount: Array.from(mergedAmounts.values()).reduce((sum, amount) => sum + amount, 0),
    configured: Boolean(disbursedStageId || disbursementLeads.length > 0)
  }
}
