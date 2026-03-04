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
  const baseAppointmentsFilter: any = { tenantId: tenantIdObj }

  if (role !== 'ADMIN' && role !== 'OWNER') {
    baseLoanCasesFilter.$or = [{ createdBy: userId }, { assignedAgentId: userId }]
    baseCustomersFilter.createdBy = userId
    baseAppointmentsFilter.createdBy = userId
  }

  const { start: trendStart, buckets } = weekBuckets(12)
  const now = new Date()

  const [
    customersTotal,
    loanCasesAgg,
    stageCounts,
    customersTrendRows,
    loanCasesTrendRows,
    upcomingAppointmentsCount,
    completedAppointmentsCount,
    pendingOutcomeAppointmentsCount,
    upcomingAppointmentsRows
  ] = await Promise.all([
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
      .toArray(),
    db.collection('appointments').countDocuments({
      ...baseAppointmentsFilter,
      scheduledAt: { $gte: now },
      status: { $in: ['SCHEDULED', 'PENDING', 'RESCHEDULED'] }
    }),
    db.collection('appointments').countDocuments({
      ...baseAppointmentsFilter,
      status: 'COMPLETED'
    }),
    db.collection('appointments').countDocuments({
      ...baseAppointmentsFilter,
      scheduledAt: { $lt: now },
      status: { $in: ['SCHEDULED', 'PENDING'] },
      $or: [{ outcomeComments: null }, { outcomeComments: '' }]
    }),
    db
      .collection('appointments')
      .aggregate([
        {
          $match: {
            ...baseAppointmentsFilter,
            scheduledAt: { $gte: now },
            status: { $in: ['SCHEDULED', 'PENDING', 'RESCHEDULED'] }
          }
        },
        { $sort: { scheduledAt: 1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'customers',
            let: { customerId: '$customerId', tenantId: '$tenantId' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$_id', '$$customerId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
              { $project: { fullName: 1 } }
            ],
            as: 'customer'
          }
        },
        { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'loanCases',
            let: { leadId: '$leadId', tenantId: '$tenantId' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$_id', '$$leadId'] }, { $eq: ['$tenantId', '$$tenantId'] }] } } },
              { $project: { loanTypeId: 1, bankName: 1 } }
            ],
            as: 'lead'
          }
        },
        { $unwind: { path: '$lead', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'loanTypes',
            let: { loanTypeId: '$lead.loanTypeId', tenantId: '$tenantId' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$_id', '$$loanTypeId'] },
                      { $eq: ['$tenantId', '$$tenantId'] }
                    ]
                  }
                }
              },
              { $project: { name: 1 } }
            ],
            as: 'loanType'
          }
        },
        { $unwind: { path: '$loanType', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            leadId: 1,
            customerId: 1,
            scheduledAt: 1,
            followUpType: 1,
            status: 1,
            outcomeComments: 1,
            customerName: '$customer.fullName',
            leadLoanTypeName: '$loanType.name',
            leadBankName: '$lead.bankName'
          }
        }
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

  const upcomingAppointments = (upcomingAppointmentsRows || []).map((r: any) => {
    const loanTypeName = r?.leadLoanTypeName ? String(r.leadLoanTypeName) : null
    const bankName = r?.leadBankName != null ? String(r.leadBankName) : null
    const leadTitle = loanTypeName ? `${loanTypeName}${bankName ? ` • ${bankName}` : ''}` : null

    return {
      id: String(r?._id),
      leadId: r?.leadId ? String(r.leadId) : null,
      customerId: r?.customerId ? String(r.customerId) : null,
      scheduledAt: r?.scheduledAt ? new Date(r.scheduledAt).toISOString() : null,
      followUpType: r?.followUpType ? String(r.followUpType) : null,
      status: String(r?.status || 'SCHEDULED') === 'SCHEDULED' ? 'PENDING' : String(r?.status || 'PENDING'),
      outcomeComments: r?.outcomeComments ?? null,
      customerName: r?.customerName ? String(r.customerName) : null,
      leadTitle
    }
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
    appointments: {
      upcomingCount: Number(upcomingAppointmentsCount || 0),
      completedCount: Number(completedAppointmentsCount || 0),
      pendingOutcomeCount: Number(pendingOutcomeAppointmentsCount || 0),
      upcoming: upcomingAppointments
    },
    agents
  })
}

