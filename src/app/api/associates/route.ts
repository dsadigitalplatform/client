export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

function isValidEmail(v: unknown) {
  return typeof v === 'string' && /^.+@.+\..+$/.test(v)
}

function isValidCountryCode(v: unknown) {
  return typeof v === 'string' && /^\+[0-9]{1,4}$/.test(v)
}

function isValidMobile(v: unknown) {
  return typeof v === 'string' && /^[0-9]{9,10}$/.test(v)
}

function isValidPAN(v: unknown) {
  if (v == null) return true
  const s = String(v)

  if (s.trim().length === 0) return true

  return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(s)
}

function isValidPayout(v: unknown) {
  if (v == null) return true
  const n = Number(v)

  return Number.isFinite(n) && n >= 0 && n <= 100
}

const buildBaseCode = (associateName: string, companyName: string, mobile: string) => {
  const nameWords = associateName.trim().split(/\s+/).filter(Boolean)
  const companyWords = companyName.trim().split(/\s+/).filter(Boolean)

  const nameInitials =
    nameWords.length > 0 ? nameWords.slice(0, 2).map(w => w[0]?.toUpperCase()).join('') : associateName.trim().slice(0, 2).toUpperCase()

  const companyKeyRaw = companyWords.length > 0 ? companyWords.join('') : companyName
  const companyKey = companyKeyRaw.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3)

  const last4 = mobile.replace(/\D/g, '').slice(-4)

  return [nameInitials, companyKey, last4].filter(Boolean).join('-')
}

const generateUniqueCode = async (
  db: any,
  tenantId: ObjectId,
  associateName: string,
  companyName: string,
  mobile: string,
  excludeId?: ObjectId
) => {
  const base = buildBaseCode(associateName, companyName, mobile)
  const safeBase = base.length > 0 ? base : 'ASSOC'
  let suffix = 0

  for (let i = 0; i < 50; i++) {
    const code = suffix === 0 ? safeBase : `${safeBase}-${suffix + 1}`
    const filter: any = { tenantId, code }

    if (excludeId) filter._id = { $ne: excludeId }
    const existing = await db.collection('associates').findOne(filter, { projection: { _id: 1 } })

    if (!existing) return code
    suffix += 1
  }

  return `${safeBase}-${Date.now()}`
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
      { associateName: { $regex: safe, $options: 'i' } },
      { companyName: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { mobile: { $regex: safe } },
      { code: { $regex: safe, $options: 'i' } }
    ]
  }

  const rows = await db
    .collection('associates')
    .find(baseFilter, {
      projection: {
        associateName: 1,
        companyName: 1,
        associateTypeId: 1,
        countryCode: 1,
        mobile: 1,
        email: 1,
        payout: 1,
        code: 1,
        pan: 1,
        isActive: 1,
        createdAt: 1
      }
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const typeIds = Array.from(
    new Set(rows.map(r => (r as any).associateTypeId).filter((id: any) => id && ObjectId.isValid(id)))
  ).map(id => new ObjectId(String(id)))

  const typeRows =
    typeIds.length > 0
      ? await db
          .collection('associateTypes')
          .find({ tenantId: tenantIdObj, _id: { $in: typeIds } }, { projection: { name: 1 } })
          .toArray()
      : []

  const typeNameById = new Map<string, string>()

  typeRows.forEach(t => typeNameById.set(String((t as any)._id), String((t as any).name || '')))

  const associates = rows.map(r => ({
    id: String((r as any)._id),
    associateName: String((r as any).associateName || ''),
    companyName: String((r as any).companyName || ''),
    associateTypeId: (r as any).associateTypeId ? String((r as any).associateTypeId) : '',
    associateTypeName: (r as any).associateTypeId ? typeNameById.get(String((r as any).associateTypeId)) || null : null,
    countryCode: isValidCountryCode((r as any).countryCode) ? String((r as any).countryCode) : '+91',
    mobile: String((r as any).mobile || ''),
    email: (r as any).email ? String((r as any).email) : null,
    payout: (r as any).payout ?? null,
    code: String((r as any).code || ''),
    pan: (r as any).pan ? String((r as any).pan) : null,
    isActive: Boolean((r as any).isActive),
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null
  }))

  return NextResponse.json({ associates })
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

  const associateName = String(body.associateName || '').trim()
  const companyName = String(body.companyName || '').trim()
  const associateTypeIdRaw = String(body.associateTypeId || '').trim()
  const countryCode = body.countryCode == null ? '+91' : String(body.countryCode).trim()
  const mobile = String(body.mobile || '').trim()
  const email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  const payout = body.payout == null || String(body.payout).trim().length === 0 ? null : Number(body.payout)
  const pan = body.pan ? String(body.pan).toUpperCase().trim() : null
  const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true

  const errors: Record<string, string> = {}

  if (associateName.length < 2) errors.associateName = 'Associate name must be at least 2 characters'
  if (companyName.length < 2) errors.companyName = 'Company name must be at least 2 characters'
  if (!ObjectId.isValid(associateTypeIdRaw)) errors.associateTypeId = 'Associate type is required'
  if (!isValidCountryCode(countryCode)) errors.countryCode = 'Invalid country code'
  if (!isValidMobile(mobile)) errors.mobile = 'Mobile must be 9 or 10 digits'
  if (email && !isValidEmail(email)) errors.email = 'Invalid email format'
  if (!isValidPAN(pan)) errors.pan = 'Invalid PAN format'
  if (payout != null && !isValidPayout(payout)) errors.payout = 'Payout must be between 0 and 100'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  const associateTypeId = new ObjectId(associateTypeIdRaw)

  const associateType = await db
    .collection('associateTypes')
    .findOne({ _id: associateTypeId, tenantId: tenantIdObj, isActive: true }, { projection: { _id: 1 } })

  if (!associateType) {
    return NextResponse.json(
      { error: 'validation_error', details: { associateTypeId: 'Associate type is required' } },
      { status: 400 }
    )
  }

  const code = await generateUniqueCode(db, tenantIdObj, associateName, companyName, mobile)
  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    associateName,
    companyName,
    associateTypeId,
    countryCode,
    mobile,
    email,
    payout,
    code,
    pan,
    isActive,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    const res = await db.collection('associates').insertOne(doc)

    return NextResponse.json({ id: res.insertedId.toHexString(), code }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_record', message: 'Associate already exists for this tenant' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}
