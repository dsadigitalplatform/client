import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await request.formData()
  const tenantId = String(form.get('tenantId') || '')
  if (!tenantId) return NextResponse.json({ error: 'tenantId_required' }, { status: 400 })

  const db = await getDb()
  const membership = await db
    .collection('memberships')
    .findOne({ userId: new ObjectId(session.userId), tenantId: new ObjectId(tenantId), status: 'active' })
  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  cookies().set('CURRENT_TENANT_ID', tenantId, { path: '/', httpOnly: true })

  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect') || '/home'

  return NextResponse.redirect(new URL(redirectTo, url.origin))
}
