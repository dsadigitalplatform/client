export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { migrateBanksFromLoanCases } from '@features/banks/server/migrateBanksFromLoanCases.server'

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!(session as any)?.isSuperAdmin) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Only super admins can import banks from leads' },
      { status: 403 }
    )
  }

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const tenantIdObj = new ObjectId(currentTenantId)

  try {
    const result = await migrateBanksFromLoanCases(db, tenantIdObj, userId)

    return NextResponse.json(result)
  } catch {
    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
