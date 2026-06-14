export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { getReportTenantContext } from '@features/reports/server/reportContext.server'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const ctx = await getReportTenantContext(session as Parameters<typeof getReportTenantContext>[0])

  if ('error' in ctx) return ctx.error

  const { db, tenantIdObj, role, userId } = ctx

  const [stages, loanTypes, banks, agents, customers] = await Promise.all([
    db
      .collection('loanStatusPipelineStages')
      .find({ tenantId: tenantIdObj }, { projection: { name: 1, order: 1, isLoggedIn: 1, isDisbursed: 1 } })
      .sort({ order: 1, name: 1 })
      .toArray(),
    db
      .collection('loanTypes')
      .find({ tenantId: tenantIdObj, isActive: { $ne: false } }, { projection: { name: 1 } })
      .sort({ name: 1 })
      .toArray(),
    db
      .collection('banks')
      .find({ tenantId: tenantIdObj }, { projection: { name: 1 } })
      .sort({ name: 1 })
      .toArray(),
    role === 'ADMIN' || role === 'OWNER'
      ? db
          .collection('memberships')
          .aggregate([
            { $match: { tenantId: tenantIdObj, status: 'active' } },
            {
              $lookup: {
                from: 'users',
                localField: 'userId',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, email: 1 } }],
                as: 'user'
              }
            },
            { $unwind: '$user' },
            { $sort: { 'user.name': 1 } },
            {
              $project: {
                userId: 1,
                name: '$user.name',
                email: '$user.email'
              }
            }
          ])
          .toArray()
      : db
          .collection('users')
          .find({ _id: userId }, { projection: { name: 1, email: 1 } })
          .toArray()
          .then(rows =>
            rows.map(r => ({
              userId: r._id,
              name: r.name,
              email: r.email
            }))
          ),
    db
      .collection('customers')
      .find(
        role !== 'ADMIN' && role !== 'OWNER' ? { tenantId: tenantIdObj, createdBy: userId } : { tenantId: tenantIdObj },
        { projection: { fullName: 1 } }
      )
      .sort({ fullName: 1 })
      .limit(500)
      .toArray()
  ])

  const bankNamesFromLeads = await db
    .collection('loanCases')
    .aggregate([
      { $match: { tenantId: tenantIdObj, bankName: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$bankName' } },
      { $sort: { _id: 1 } }
    ])
    .toArray()

  const bankSet = new Set<string>()

  banks.forEach(b => {
    if (b.name) bankSet.add(String(b.name))
  })
  bankNamesFromLeads.forEach(b => {
    if (b._id) bankSet.add(String(b._id))
  })

  return NextResponse.json({
    stages: stages.map(s => ({
      id: String(s._id),
      name: String(s.name || ''),
      order: Number(s.order ?? 0),
      isLoggedIn: Boolean((s as { isLoggedIn?: boolean }).isLoggedIn),
      isDisbursed: Boolean((s as { isDisbursed?: boolean }).isDisbursed)
    })),
    agents: agents.map(a => ({
      id: String(a.userId),
      name: a.name ? String(a.name) : null,
      email: a.email ? String(a.email) : null
    })),
    customers: customers.map(c => ({
      id: String(c._id),
      name: String(c.fullName || '')
    })),
    loanTypes: loanTypes.map(l => ({
      id: String(l._id),
      name: String(l.name || '')
    })),
    banks: Array.from(bankSet)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name }))
  })
}
