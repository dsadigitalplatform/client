import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!(session as any)?.isSuperAdmin) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const actorUserId = String((session as any)?.userId || '')
  const url = new URL(request.url)
  const q = String(url.searchParams.get('q') || '').trim()
  const safe = q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const db = await getDb()
  const baseFilter: any = {}

  if (ObjectId.isValid(actorUserId)) {
    baseFilter._id = { $ne: new ObjectId(actorUserId) }
  }

  if (safe) {
    baseFilter.$or = [{ name: { $regex: safe, $options: 'i' } }, { email: { $regex: safe, $options: 'i' } }]
  }

  const users = await db
    .collection('users')
    .find(baseFilter, { projection: { _id: 1, name: 1, email: 1, isSuperAdmin: 1 } })
    .sort({ name: 1, email: 1 })
    .limit(50)
    .toArray()

  return NextResponse.json({
    users: users.map(u => ({
      id: String((u as any)._id),
      name: String((u as any).name || ''),
      email: (u as any).email ?? null,
      isSuperAdmin: Boolean((u as any).isSuperAdmin)
    }))
  })
}
