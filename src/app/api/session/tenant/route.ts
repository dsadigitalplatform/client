export const dynamic = 'force-dynamic'
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

  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirect') || '/home'

  const ret = url.searchParams.get('return')

  if (ret === 'json') {
    const res = NextResponse.json({ success: true })

    res.cookies.set('CURRENT_TENANT_ID', tenantId, { path: '/', httpOnly: true })

    
return res
  }

  const res = NextResponse.redirect(new URL(redirectTo, url.origin))

  res.cookies.set('CURRENT_TENANT_ID', tenantId, { path: '/', httpOnly: true })

  
return res
}

export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const store = await cookies()
  const currentTenantId = store.get('CURRENT_TENANT_ID')?.value || ''

  if (currentTenantId && ObjectId.isValid(currentTenantId)) {
    const db = await getDb()
    const userId = new ObjectId(session.userId!)
    const tenantId = new ObjectId(currentTenantId)

    const membership = await db
      .collection('memberships')
      .findOne({ userId, tenantId, status: 'active' }, { projection: { role: 1 } })

    const t = await db
      .collection('tenants')
      .findOne({ _id: tenantId }, { projection: { name: 1, 'theme.primaryColor': 1 } })

    const role = (membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined) || undefined
    const tenantName = (t?.name as string | undefined) || undefined
    const primaryColor = ((t as any)?.theme?.primaryColor as string | undefined) || undefined

    return NextResponse.json({ currentTenantId, role, tenantName, primaryColor })
  }

  
return NextResponse.json({ currentTenantId })
}
