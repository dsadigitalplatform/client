export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

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
    userId,
    role: String((membership as any).role || 'USER') as 'OWNER' | 'ADMIN' | 'USER'
  }
}

function startOfDay(d: Date) {
  const out = new Date(d)

  out.setHours(0, 0, 0, 0)
  
return out
}

function addDays(d: Date, days: number) {
  const out = new Date(d)

  out.setDate(out.getDate() + days)
  
return out
}

function weekBuckets(weeks: number) {
  const now = startOfDay(new Date())
  const start = addDays(now, -7 * (weeks - 1))
  const buckets: Array<{ start: Date; label: string }> = []

  for (let i = 0; i < weeks; i++) {
    const s = addDays(start, i * 7)
    const label = s.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })

    buckets.push({ start: s, label })
  }

  return { start, buckets }
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getTenantContext(session as any)

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, userId, role } = ctx

  const baseLoanCasesFilter: any = { tenantId: tenantIdObj }
  const baseCustomersFilter: any = { tenantId: tenantIdObj }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    baseLoanCasesFilter.$or = [{ createdBy: userId }, { assignedAgentId: userId }]
    baseCustomersFilter.createdBy = userId
  }

  const { start: trendStart, buckets } = weekBuckets(12)

  const [customersTotal, loanCasesAgg, stageCounts, customersTrendRows, loanCasesTrendRows] = await Promise.all([
    db.collection('customers').countDocuments(baseCustomersFilter),
    db
      .collection('loanCases')
      .aggregate([
        { $match: baseLoanCasesFilter },
        {
          $group: {
            _id: null,
            totalCases: { $sum: 1 },
            requestedLoanVolume: { $sum: { $ifNull: ['$requestedAmount', 0] } }
          }
        }
      ])
      .toArray(),
    db
      .collection('loanCases')
      .aggregate([
        { $match: baseLoanCasesFilter },
        { $group: { _id: '$stageId', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'loanStatusPipelineStages',
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, order: 1 } }],
            as: 'stage'
          }
        },
        { $unwind: { path: '$stage', preserveNullAndEmptyArrays: true } },
        { $addFields: { stageName: '$stage.name', order: '$stage.order' } },
        { $project: { stageId: '$_id', stageName: 1, order: 1, count: 1 } },
        { $sort: { order: 1, stageName: 1 } }
      ])
      .toArray(),
    db
      .collection('customers')
      .aggregate([
        { $match: { ...baseCustomersFilter, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit: 'week' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray(),
    db
      .collection('loanCases')
      .aggregate([
        { $match: { ...baseLoanCasesFilter, createdAt: { $gte: trendStart } } },
        {
          $group: {
            _id: { $dateTrunc: { date: '$createdAt', unit: 'week' } },
            count: { $sum: 1 },
            requestedLoanVolume: { $sum: { $ifNull: ['$requestedAmount', 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ])
      .toArray()
  ])

  const totals = loanCasesAgg?.[0] || { totalCases: 0, requestedLoanVolume: 0 }

  const customersTrendByBucket = new Map<string, number>()

  customersTrendRows.forEach((r: any) => {
    const key = new Date(r._id).toISOString().slice(0, 10)

    customersTrendByBucket.set(key, Number(r.count || 0))
  })

  const loanCasesTrendByBucket = new Map<string, { count: number; requestedLoanVolume: number }>()

  loanCasesTrendRows.forEach((r: any) => {
    const key = new Date(r._id).toISOString().slice(0, 10)

    loanCasesTrendByBucket.set(key, {
      count: Number(r.count || 0),
      requestedLoanVolume: Number(r.requestedLoanVolume || 0)
    })
  })

  const customersTrend = buckets.map(b => {
    const key = b.start.toISOString().slice(0, 10)

    
return { label: b.label, value: customersTrendByBucket.get(key) || 0 }
  })

  const loanCasesTrend = buckets.map(b => {
    const key = b.start.toISOString().slice(0, 10)
    const v = loanCasesTrendByBucket.get(key) || { count: 0, requestedLoanVolume: 0 }

    
return { label: b.label, count: v.count, requestedLoanVolume: v.requestedLoanVolume }
  })

  let agents: any = null

  if (role === 'ADMIN' || role === 'OWNER') {
    const agentRows = await db
      .collection('loanCases')
      .aggregate([
        { $match: { tenantId: tenantIdObj, assignedAgentId: { $type: 'objectId' } } },
        {
          $group: {
            _id: '$assignedAgentId',
            totalCases: { $sum: 1 },
            requestedLoanVolume: { $sum: { $ifNull: ['$requestedAmount', 0] } }
          }
        },
        { $sort: { totalCases: -1 } },
        { $limit: 6 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            pipeline: [{ $project: { name: 1, email: 1 } }],
            as: 'user'
          }
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            userId: '$_id',
            name: '$user.name',
            email: '$user.email',
            totalCases: 1,
            requestedLoanVolume: 1
          }
        }
      ])
      .toArray()

    agents = {
      top: agentRows.map((r: any) => ({
        id: String(r.userId),
        name: r?.name ? String(r.name) : null,
        email: r?.email ? String(r.email) : null,
        totalCases: Number(r.totalCases || 0),
        requestedLoanVolume: Number(r.requestedLoanVolume || 0)
      }))
    }
  }

  return NextResponse.json({
    customers: {
      total: customersTotal,
      trend: customersTrend
    },
    loanCases: {
      total: Number(totals.totalCases || 0),
      requestedLoanVolume: Number(totals.requestedLoanVolume || 0),
      trend: loanCasesTrend,
      byStage: stageCounts.map((s: any) => ({
        stageId: s.stageId ? String(s.stageId) : null,
        stageName: s.stageName ? String(s.stageName) : 'Unassigned',
        count: Number(s.count || 0)
      }))
    },
    agents
  })
}

