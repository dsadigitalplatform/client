import { NextResponse } from 'next/server'

import { getDb } from '@/lib/mongodb'

export async function GET() {
  const db = await getDb()

  const users = await db
    .collection('users')
    .find({}, { projection: { _id: 1, email: 1, name: 1, isSuperAdmin: 1 } })
    .limit(25)
    .toArray()

  return NextResponse.json({ users })
}
