import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const userIdRaw = String(session.userId)
  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }, { userId: userIdRaw }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const memberships = await db
    .collection('memberships')
    .find({ status: { $regex: '^active$', $options: 'i' }, $or: orFilters }, { projection: { tenantId: 1, role: 1 } })
    .toArray()

  const tenantIds = memberships.map(m => {
    const tenantId = (m as any)?.tenantId

    return typeof tenantId?.toHexString === 'function' ? tenantId.toHexString() : String(tenantId)
  })

  return NextResponse.json({ count: memberships.length, tenantIds, memberships })
}
