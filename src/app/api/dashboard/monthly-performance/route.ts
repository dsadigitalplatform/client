export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { getHistoricalStageSummary } from '@features/reports/server/historicalStageSummary.server'
import { getMergedMonthlyDisbursedSummary } from '@features/reports/server/monthlyDisbursedMetrics.server'
import {
  findDisbursedStageId,
  findLoggedInStageIds,
  findRejectedStageIds,
  getCurrentMonthDateRange
} from '@features/reports/utils/monthlyReportHelpers'

function escapeRegexLiteral(input: string) {
  return input.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

async function getTenantContext(session: any) {
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String(session?.currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  if (!ObjectId.isValid(currentTenantId)) return { error: NextResponse.json({ error: 'invalid_tenant' }, { status: 400 }) }

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const email = String(session?.user?.email || '')

  const emailFilter =
    email && email.length > 0 ? { email: { $regex: `^${escapeRegexLiteral(email)}$`, $options: 'i' } } : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return { error: NextResponse.json({ error: 'not_member' }, { status: 403 }) }

  return {
    db,
    tenantIdObj,
    tenantIdHex: currentTenantId,
    userId,
    role: String((membership as any).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

type StageMetric = {
  stageId: string | null
  stageName: string | null
  configured: boolean
  totalCases: number
  totalAmount: number
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, tenantIdHex, userId, role } = ctx
  const assignedAgentId = new URL(request.url).searchParams.get('assignedAgentId')
  const { dateFrom, dateTo } = getCurrentMonthDateRange()

  const stageRows = await db
    .collection('loanStatusPipelineStages')
    .find({ tenantId: tenantIdObj }, { projection: { name: 1, order: 1, isLoggedIn: 1, isDisbursed: 1, isClosed: 1, isRejected: 1 } })
    .sort({ order: 1 })
    .toArray()

  const stages = stageRows.map(s => ({
    id: String(s._id),
    name: String(s.name || ''),
    order: Number((s as { order?: number }).order || 0),
    isLoggedIn: Boolean((s as { isLoggedIn?: boolean }).isLoggedIn),
    isDisbursed: Boolean((s as { isDisbursed?: boolean }).isDisbursed),
    isClosed: Boolean((s as { isClosed?: boolean }).isClosed),
    isRejected: Boolean((s as { isRejected?: boolean }).isRejected)
  }))

  const loggedInStageIds = findLoggedInStageIds(stages)
  const disbursedStageId = findDisbursedStageId(stages)
  const rejectedStageIds = findRejectedStageIds(stages)

  const stageNameById = new Map(stages.map(s => [s.id, s.name]))

  async function loadLoggedInMetric(): Promise<StageMetric> {
    if (loggedInStageIds.length === 0) {
      return {
        stageId: null,
        stageName: null,
        configured: false,
        totalCases: 0,
        totalAmount: 0
      }
    }

    const summary = await getHistoricalStageSummary(
      db,
      tenantIdObj,
      tenantIdHex,
      userId,
      role,
      loggedInStageIds,
      dateFrom,
      dateTo,
      assignedAgentId
    )

    const stageNames = loggedInStageIds
      .map(id => stageNameById.get(id))
      .filter((name): name is string => Boolean(name))

    return {
      stageId: loggedInStageIds.length === 1 ? loggedInStageIds[0] : null,
      stageName: stageNames.length > 0 ? stageNames.join(', ') : null,
      configured: true,
      totalCases: summary.totalCases,
      totalAmount: summary.totalAmount
    }
  }

  async function loadDisbursedMetric(): Promise<StageMetric> {
    const summary = await getMergedMonthlyDisbursedSummary(
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

    return {
      stageId: disbursedStageId,
      stageName: disbursedStageId ? stageNameById.get(disbursedStageId) || null : null,
      configured: summary.configured,
      totalCases: summary.totalCases,
      totalAmount: summary.totalAmount
    }
  }

  async function loadRejectedMetric(): Promise<StageMetric> {
    if (rejectedStageIds.length === 0) {
      return {
        stageId: null,
        stageName: null,
        configured: false,
        totalCases: 0,
        totalAmount: 0
      }
    }

    const summary = await getHistoricalStageSummary(
      db,
      tenantIdObj,
      tenantIdHex,
      userId,
      role,
      rejectedStageIds,
      dateFrom,
      dateTo,
      assignedAgentId
    )

    const stageNames = rejectedStageIds
      .map(id => stageNameById.get(id))
      .filter((name): name is string => Boolean(name))

    return {
      stageId: rejectedStageIds.length === 1 ? rejectedStageIds[0] : null,
      stageName: stageNames.length > 0 ? stageNames.join(', ') : null,
      configured: true,
      totalCases: summary.totalCases,
      totalAmount: summary.totalAmount
    }
  }

  const [loggedIn, disbursed, rejected] = await Promise.all([
    loadLoggedInMetric(),
    loadDisbursedMetric(),
    loadRejectedMetric()
  ])

  return NextResponse.json({
    dateFrom,
    dateTo,
    loggedIn,
    disbursed,
    rejected
  })
}
