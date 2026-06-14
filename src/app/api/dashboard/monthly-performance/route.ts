export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { getHistoricalStageSummary } from '@features/reports/server/historicalStageSummary.server'
import {
  findDisbursedStageId,
  findLoggedInStageId,
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
    .find({ tenantId: tenantIdObj }, { projection: { name: 1, order: 1, isLoggedIn: 1, isDisbursed: 1 } })
    .sort({ order: 1 })
    .toArray()

  const stages = stageRows.map(s => ({
    id: String(s._id),
    name: String(s.name || ''),
    order: Number((s as { order?: number }).order || 0),
    isLoggedIn: Boolean((s as { isLoggedIn?: boolean }).isLoggedIn),
    isDisbursed: Boolean((s as { isDisbursed?: boolean }).isDisbursed)
  }))

  const loggedInStageId = findLoggedInStageId(stages)
  const disbursedStageId = findDisbursedStageId(stages)

  const stageNameById = new Map(stages.map(s => [s.id, s.name]))

  async function loadMetric(stageId: string | null): Promise<StageMetric> {
    if (!stageId) {
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
      stageId,
      dateFrom,
      dateTo,
      assignedAgentId
    )

    return {
      stageId,
      stageName: stageNameById.get(stageId) || null,
      configured: true,
      totalCases: summary.totalCases,
      totalAmount: summary.totalAmount
    }
  }

  const [loggedIn, disbursed] = await Promise.all([loadMetric(loggedInStageId), loadMetric(disbursedStageId)])

  return NextResponse.json({
    dateFrom,
    dateTo,
    loggedIn,
    disbursed
  })
}
