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
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (currentTenantId && ObjectId.isValid(currentTenantId)) {
    const db = await getDb()
    const userId = new ObjectId(session.userId!)
    const email = String((session as any)?.user?.email || '')

    const emailFilter =
      email && email.length > 0
        ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
        : undefined

    const orFilters = [{ userId }] as any[]

    if (emailFilter) orFilters.push(emailFilter)
    const tenantId = new ObjectId(currentTenantId)

    const membership = await db
      .collection('memberships')
      .findOne({ tenantId, status: 'active', $or: orFilters }, { projection: { role: 1 } })

    const t = await db
      .collection('tenants')
      .findOne({ _id: tenantId }, { projection: { name: 1, 'theme.primaryColor': 1 } })

    const role = (membership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined) || undefined
    const tenantName = (t?.name as string | undefined) || undefined
    const primaryColor = ((t as any)?.theme?.primaryColor as string | undefined) || undefined

    if (!cookieTenantId && sessionTenantId === currentTenantId) {
      const res = NextResponse.json({ currentTenantId, role, tenantName, primaryColor })

      res.cookies.set('CURRENT_TENANT_ID', currentTenantId, { path: '/', httpOnly: true })

      return res
    }

    return NextResponse.json({ currentTenantId, role, tenantName, primaryColor })
  }

  const db = await getDb()
  const userId = new ObjectId(session.userId!)

  const email = String((session as any)?.user?.email || '')

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const fallbackMembership = await db
    .collection('memberships')
    .findOne({ status: 'active', $or: orFilters }, { projection: { tenantId: 1, role: 1 }, sort: { createdAt: -1 } })

  const fallbackTenantId = fallbackMembership?.tenantId ? (fallbackMembership.tenantId as ObjectId).toHexString() : ''

  if (fallbackTenantId && ObjectId.isValid(fallbackTenantId)) {
    const tenantId = new ObjectId(fallbackTenantId)

    const t = await db
      .collection('tenants')
      .findOne({ _id: tenantId }, { projection: { name: 1, 'theme.primaryColor': 1 } })

    const role = (fallbackMembership?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined) || undefined
    const tenantName = (t?.name as string | undefined) || undefined
    const primaryColor = ((t as any)?.theme?.primaryColor as string | undefined) || undefined

    const res = NextResponse.json({ currentTenantId: fallbackTenantId, role, tenantName, primaryColor })

    res.cookies.set('CURRENT_TENANT_ID', fallbackTenantId, { path: '/', httpOnly: true })

    return res
  }

  return NextResponse.json({ currentTenantId })
}
