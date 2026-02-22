export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''

  if (!token || token.length < 10) return NextResponse.json({ error: 'invalid_token' }, { status: 400 })

  const db = await getDb()
  const now = new Date()

  const invited = await db
    .collection('memberships')
    .findOne({ inviteToken: token, status: 'invited', expiresAt: { $gt: now } })

  if (!invited) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const tenant = await db.collection('tenants').findOne(
    { _id: new ObjectId(String(invited.tenantId)) },
    { projection: { name: 1 } }
  )

  const invitedEmail = String((invited as any).email || '')
  const sessionEmail = String((session as any)?.user?.email || '')
  const emailMatches = invitedEmail.toLowerCase() === sessionEmail.toLowerCase()

  
return NextResponse.json({
    tenantName: String(tenant?.name || ''),
    role: String((invited as any).role || ''),
    invitedEmail,
    emailMatches
  })
}
