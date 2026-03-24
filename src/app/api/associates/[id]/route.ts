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

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const row = await db.collection('associates').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const data = {
    id: String((row as any)._id),
    associateName: (row as any).associateName || '',
    companyName: (row as any).companyName || '',
    countryCode: isValidCountryCode((row as any).countryCode) ? String((row as any).countryCode) : '+91',
    mobile: (row as any).mobile || '',
    email: (row as any).email ?? null,
    payout: (row as any).payout ?? null,
    code: (row as any).code || '',
    pan: (row as any).pan ?? null,
    isActive: Boolean((row as any).isActive)
  }

  return NextResponse.json(data)
}

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const body = await request.json().catch(() => ({}))

  const patch: any = {}

  if (body.associateName != null) patch.associateName = String(body.associateName).trim()
  if (body.companyName != null) patch.companyName = String(body.companyName).trim()
  if (body.countryCode !== undefined)
    patch.countryCode = body.countryCode == null || String(body.countryCode).trim().length === 0 ? '+91' : String(body.countryCode).trim()
  if (body.mobile != null) patch.mobile = String(body.mobile).trim()
  if (body.email !== undefined) patch.email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  if (body.payout !== undefined) patch.payout = body.payout == null ? null : Number(body.payout)
  if (body.pan !== undefined) patch.pan = body.pan ? String(body.pan).toUpperCase().trim() : null
  if (body.isActive !== undefined) patch.isActive = Boolean(body.isActive)

  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}

  if (patch.associateName != null && patch.associateName.length < 2)
    errors.associateName = 'Associate name must be at least 2 characters'
  if (patch.companyName != null && patch.companyName.length < 2)
    errors.companyName = 'Company name must be at least 2 characters'
  if (patch.countryCode != null && !isValidCountryCode(patch.countryCode)) errors.countryCode = 'Invalid country code'
  if (patch.mobile != null && !isValidMobile(patch.mobile)) errors.mobile = 'Mobile must be 9 or 10 digits'
  if (patch.email != null && !isValidEmail(patch.email)) errors.email = 'Invalid email format'
  if (patch.pan != null && !isValidPAN(patch.pan)) errors.pan = 'Invalid PAN format'
  if (patch.payout != null && !isValidPayout(patch.payout)) errors.payout = 'Payout must be between 0 and 100'

  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  if (patch.associateName != null || patch.companyName != null || patch.mobile != null) {
    const existing = await db
      .collection('associates')
      .findOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { projection: { associateName: 1, companyName: 1, mobile: 1 } })

    if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const nextName = patch.associateName ?? String((existing as any).associateName || '')
    const nextCompany = patch.companyName ?? String((existing as any).companyName || '')
    const nextMobile = patch.mobile ?? String((existing as any).mobile || '')

    patch.code = await generateUniqueCode(db, tenantIdObj, nextName, nextCompany, nextMobile, new ObjectId(id))
  }

  try {
    const res = await db
      .collection('associates')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: patch })

    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_record', message: 'Associate already exists for this tenant' }, { status: 409 })
    }

    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params

  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const sessionTenantId = String((session as any).currentTenantId || '')
  const currentTenantId = cookieTenantId || sessionTenantId

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  if (!ObjectId.isValid(currentTenantId)) return NextResponse.json({ error: 'invalid_tenant' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const res = await db.collection('associates').deleteOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ ok: true })
}
