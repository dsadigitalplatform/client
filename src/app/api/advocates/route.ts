export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { isValidCountryCode } from '@/lib/countryCodes'
import { getDb } from '@/lib/mongodb'

function isValidEmail(v: unknown) {
  return typeof v === 'string' && /^.+@.+\..+$/.test(v)
}

function isValidMobile(v: unknown) {
  return typeof v === 'string' && /^[0-9]{8,10}$/.test(v)
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const userEmail = String((session as any)?.user?.email || '')

  const emailFilter =
    userEmail && userEmail.length > 0
      ? { email: { $regex: `^${userEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    baseFilter.$or = [
      { name: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { mobile: { $regex: safe } },
      { address: { $regex: safe, $options: 'i' } }
    ]
  }

  const rows = await db
    .collection('advocates')
    .find(baseFilter, {
      projection: {
        name: 1,
        countryCode: 1,
        mobile: 1,
        email: 1,
        address: 1,
        createdAt: 1
      }
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const advocates = rows.map(r => ({
    id: String((r as any)._id),
    name: String((r as any).name || ''),
    countryCode: isValidCountryCode((r as any).countryCode) ? String((r as any).countryCode) : '+91',
    mobile: String((r as any).mobile || ''),
    email: (r as any).email ? String((r as any).email) : null,
    address: (r as any).address ? String((r as any).address) : null,
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null
  }))

  return NextResponse.json({ advocates })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const userEmail = String((session as any)?.user?.email || '')

  const emailFilter =
    userEmail && userEmail.length > 0
      ? { email: { $regex: `^${userEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)
  const tenantIdObj = new ObjectId(currentTenantId)

  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const body = await request.json().catch(() => ({}))

  const name = String(body.name || '').trim()
  const countryCode = body.countryCode == null ? '+91' : String(body.countryCode).trim()
  const mobile = String(body.mobile || '').trim()
  const email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  const address = body.address == null || String(body.address).trim().length === 0 ? null : String(body.address).trim()

  const errors: Record<string, string> = {}

  if (name.length < 2) errors.name = 'Name must be at least 2 characters'
  if (!isValidCountryCode(countryCode)) errors.countryCode = 'Invalid country code'
  if (!isValidMobile(mobile)) errors.mobile = 'Mobile must be 8 to 10 digits'
  if (email && !isValidEmail(email)) errors.email = 'Invalid email format'
  if (address != null && address.length > 500) errors.address = 'Address must be ≤ 500 characters'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    name,
    countryCode,
    mobile,
    email,
    address,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await db.collection('advocates').insertOne(doc)

    return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_record', message: 'Advocate with this mobile already exists' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
