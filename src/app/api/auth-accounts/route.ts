import { NextResponse } from 'next/server'

import { getDb } from '@/lib/mongodb'

export async function GET() {
  const db = await getDb()

  const authAccounts = await db
    .collection('authAccounts')
    .find({}, { projection: { _id: 1, userId: 1, provider: 1, providerUserId: 1, lastLoginAt: 1 } })
    .limit(50)
    .toArray()

  return NextResponse.json({ authAccounts })
}
