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

type SecondaryContactType = 'ALTERNATE' | 'SPOUSE' | 'FRIEND' | 'RELATIVE' | 'OTHER'
const SECONDARY_CONTACT_TYPES: SecondaryContactType[] = ['ALTERNATE', 'SPOUSE', 'FRIEND', 'RELATIVE', 'OTHER']

function isValidContactType(v: unknown): v is SecondaryContactType {
  return typeof v === 'string' && SECONDARY_CONTACT_TYPES.includes(v as SecondaryContactType)
}

function isValidPAN(v: unknown) {
  if (v == null) return true
  const s = String(v)

  if (s.trim().length === 0) return true
  
return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(s)
}

function parseSecondaryContacts(input: unknown) {
  const errors: Record<string, string> = {}

  if (input == null) return { contacts: [] as Array<{ countryCode: string; mobile: string; type: SecondaryContactType }>, errors }
  if (!Array.isArray(input)) return { contacts: [], errors: { secondaryContacts: 'Secondary contacts must be an array' } }

  if (input.length > 3) errors.secondaryContacts = 'Up to 3 secondary contacts allowed'

  const contacts = input.slice(0, 3).map((row, index) => {
    const countryCode = row?.countryCode == null ? '' : String(row.countryCode).trim()
    const mobile = row?.mobile == null ? '' : String(row.mobile).trim()
    const type = row?.type == null ? '' : String(row.type).trim().toUpperCase()

    if (!isValidCountryCode(countryCode)) errors[`secondaryContacts.${index}.countryCode`] = 'Invalid country code'
    if (!isValidMobile(mobile)) errors[`secondaryContacts.${index}.mobile`] = 'Mobile must be 9 or 10 digits'
    if (!isValidContactType(type)) errors[`secondaryContacts.${index}.type`] = 'Invalid contact type'

    return {
      countryCode,
      mobile,
      type: isValidContactType(type) ? type : 'ALTERNATE'
    }
  })

  return { contacts, errors }
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
  const row = await db.collection('customers').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const data = {
    id: String((row as any)._id),
    fullName: (row as any).fullName || '',
    countryCode: isValidCountryCode((row as any).countryCode) ? String((row as any).countryCode) : '+91',
    mobile: (row as any).mobile || '',
    isNRI: Boolean((row as any).isNRI),
    email: (row as any).email ?? null,
    remarks: (row as any).remarks ?? null,
    dob: (row as any).dob ? new Date((row as any).dob).toISOString() : null,
    pan: (row as any).pan ?? null,
    aadhaarMasked: (row as any).aadhaarMasked ?? null,
    address: (row as any).address ?? null,
    secondaryContacts: Array.isArray((row as any).secondaryContacts) ? (row as any).secondaryContacts : [],
    employmentType: (row as any).employmentType,
    monthlyIncome: (row as any).monthlyIncome ?? null,
    cibilScore: (row as any).cibilScore ?? null,
    source: (row as any).source
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

  if (body.fullName != null) patch.fullName = String(body.fullName).trim()
  if (body.countryCode !== undefined)
    patch.countryCode = body.countryCode == null || String(body.countryCode).trim().length === 0 ? null : String(body.countryCode).trim()
  if (body.mobile != null) patch.mobile = String(body.mobile).trim()
  if (body.isNRI !== undefined) patch.isNRI = Boolean(body.isNRI)
  if (body.email !== undefined) patch.email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  if (body.dob !== undefined) patch.dob = body.dob ? new Date(body.dob) : null
  if (body.pan !== undefined) patch.pan = body.pan ? String(body.pan).toUpperCase().trim() : null
  if (body.aadhaarMasked !== undefined) patch.aadhaarMasked = body.aadhaarMasked ? String(body.aadhaarMasked) : null
  if (body.address !== undefined) patch.address = body.address ? String(body.address) : null
  if (body.remarks !== undefined)
    patch.remarks = body.remarks == null || String(body.remarks).trim().length === 0 ? null : String(body.remarks).trim()
  if (body.employmentType != null) patch.employmentType = String(body.employmentType).toUpperCase()
  if (body.monthlyIncome !== undefined) patch.monthlyIncome = body.monthlyIncome == null ? null : Number(body.monthlyIncome)
  if (body.cibilScore !== undefined) patch.cibilScore = body.cibilScore == null ? null : Number(body.cibilScore)
  if (body.source != null) patch.source = String(body.source).toUpperCase()

  if (body.secondaryContacts !== undefined) {
    const secondaryContactsResult = parseSecondaryContacts(body.secondaryContacts)

    if (Object.keys(secondaryContactsResult.errors).length > 0) {
      return NextResponse.json({ error: 'validation_error', details: secondaryContactsResult.errors }, { status: 400 })
    }

    patch.secondaryContacts = secondaryContactsResult.contacts
  }

  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}

  if (patch.fullName != null && patch.fullName.length < 2) errors.fullName = 'Name must be at least 2 characters'
  if (patch.countryCode != null && !isValidCountryCode(patch.countryCode)) errors.countryCode = 'Invalid country code'
  if (patch.mobile != null && !isValidMobile(patch.mobile)) errors.mobile = 'Mobile must be 9 or 10 digits'
  if (patch.email != null && !isValidEmail(patch.email)) errors.email = 'Invalid email format'
  if (patch.pan != null && !isValidPAN(patch.pan)) errors.pan = 'Invalid PAN format'
  if (patch.remarks != null && String(patch.remarks).length > 500) errors.remarks = 'Remarks must be ≤ 500 characters'
  if (patch.cibilScore != null && !(Number.isInteger(patch.cibilScore) && patch.cibilScore >= 300 && patch.cibilScore <= 900))
    errors.cibilScore = 'CIBIL must be 300–900'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  if (patch.mobile != null) {
    const existing = await db.collection('customers').findOne(
      { tenantId: tenantIdObj, mobile: patch.mobile, _id: { $ne: new ObjectId(id) } },
      { projection: { _id: 1 } }
    )

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate_mobile', message: 'This mobile has alreeady been used', details: { mobile: 'Mobile already exists' } },
        { status: 409 }
      )
    }
  }

  try {
    const res = await db
      .collection('customers')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: patch })

    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    
return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 121) {
      return NextResponse.json({ error: 'validation_error', message: 'Customer update failed validation' }, { status: 400 })
    }

    if (err && err.code === 11000) {
      const key = err?.keyPattern ? Object.keys(err.keyPattern)[0] : null

      const details =
        key === 'mobile'
          ? { mobile: 'Mobile already exists' }
          : key === 'fullName'
            ? { fullName: 'Customer name already exists' }
            : undefined

      return NextResponse.json(
        { error: 'duplicate_key', message: 'Duplicate value', details },
        { status: 409 }
      )
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
  const res = await db.collection('customers').deleteOne({ _id: new ObjectId(id), tenantId: tenantIdObj })

  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  
return NextResponse.json({ ok: true })
}
