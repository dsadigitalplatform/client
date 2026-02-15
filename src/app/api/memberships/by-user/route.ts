import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const db = await getDb()
  const memberships = await db
    .collection('memberships')
    .find({ userId: new ObjectId(session.userId), status: 'active' }, { projection: { tenantId: 1, role: 1 } })
    .toArray()

  const tenantIds = memberships.map(m => (m.tenantId as ObjectId).toHexString())
  return NextResponse.json({ count: memberships.length, tenantIds, memberships })
}
