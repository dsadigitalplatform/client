import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

const HEX = /^#([A-Fa-f0-9]{6})$/

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ success: false, error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  if (!id || !ObjectId.isValid(id)) return NextResponse.json({ success: false, error: 'invalid_tenant' }, { status: 400 })

  let body: any

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'invalid_json' }, { status: 400 })
  }

  const primaryColor = typeof body?.primaryColor === 'string' ? body.primaryColor.trim() : ''

  if (!primaryColor || !HEX.test(primaryColor))
    return NextResponse.json({ success: false, error: 'invalid_color' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const tenantId = new ObjectId(id)

  // Enforce membership and role (OWNER or ADMIN) for changing theme
  const membership = await db
    .collection('memberships')
    .findOne({ userId, tenantId, status: 'active' }, { projection: { role: 1 } })

  const role = (membership as any)?.role as 'OWNER' | 'ADMIN' | 'USER' | undefined

  if (!role || (role !== 'OWNER' && role !== 'ADMIN')) {
    return NextResponse.json({ success: false, error: 'forbidden' }, { status: 403 })
  }


  // Persist theme on tenant document
  await db
    .collection('tenants')
    .updateOne({ _id: tenantId }, { $set: { 'theme.primaryColor': primaryColor, updatedAt: new Date() } })

  return NextResponse.json({ success: true })
}
