export const dynamic = 'force-dynamic' // ensure fresh data per request
import { NextResponse } from 'next/server'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED'
type SourceType = 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'

// basic validators for payload fields
function isValidEmail(v: unknown) {
  return typeof v === 'string' && /^.+@.+\..+$/.test(v)
}

function isValidMobile(v: unknown) {
  return typeof v === 'string' && /^[0-9]{10}$/.test(v)
}

function isValidPAN(v: unknown) {
  if (v == null) return true
  const s = String(v)

  if (s.trim().length === 0) return true
  
return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(s)
}


// convert any 12+ digit input to masked Aadhaar
function maskAadhaar(input: unknown) {
  if (input == null) return null
  const digits = String(input).replace(/\D/g, '')

  if (digits.length < 4) return null
  const last4 = digits.slice(-4)

  
return `XXXX-XXXX-${last4}`
}

export async function GET(request: Request) {
  // auth + tenant guard
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const tenantIdObj = new ObjectId(currentTenantId)

  // resolve membership to gate data
  const membership = await db
    .collection('memberships')
    .findOne({ userId, tenantId: tenantIdObj, status: 'active' }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''

  // tenant-scoped filter + optional search
  const baseFilter: any = { tenantId: tenantIdObj }

  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    baseFilter.$or = [
      { fullName: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { mobile: { $regex: safe } }
    ]
  }

  // normal users restricted to their own creations
  if ((membership as any).role !== 'ADMIN' && (membership as any).role !== 'OWNER') {
    baseFilter.createdBy = userId
  }

  // projection for table
  const rows = await db
    .collection('customers')
    .find(baseFilter, {
      projection: {
        fullName: 1,
        mobile: 1,
        email: 1,
        employmentType: 1,
        monthlyIncome: 1,
        cibilScore: 1,
        source: 1,
        createdAt: 1
      }
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray()

  const customers = rows.map(r => ({
    id: String((r as any)._id),
    fullName: String((r as any).fullName || ''),
    mobile: String((r as any).mobile || ''),
    email: (r as any).email ? String((r as any).email) : null,
    employmentType: String((r as any).employmentType || '') as EmploymentType,
    monthlyIncome: (r as any).monthlyIncome ?? null,
    cibilScore: (r as any).cibilScore ?? null,
    source: String((r as any).source || '') as SourceType,
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null
  }))

  return NextResponse.json({ customers })
}

export async function POST(request: Request) {
  // auth + tenant guard
  const session = await getServerSession(authOptions)

  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const currentTenantId = String((session as any).currentTenantId || '')

  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })

  const db = await getDb()
  const userId = new ObjectId(session.userId)
  const tenantIdObj = new ObjectId(currentTenantId)

  // ensure user belongs to tenant
  const membership = await db
    .collection('memberships')
    .findOne({ userId, tenantId: tenantIdObj, status: 'active' }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  // parse + normalize payload
  const body = await request.json().catch(() => ({}))

  const fullName = String(body.fullName || '').trim()
  const mobile = String(body.mobile || '').trim()
  const email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  const dob = body.dob ? new Date(body.dob) : null
  const pan = body.pan ? String(body.pan).toUpperCase().trim() : null
  const aadhaarMasked = body.aadhaarMasked ? maskAadhaar(body.aadhaarMasked) : null
  const address = body.address ? String(body.address).trim() : null
  const employmentType = String(body.employmentType || '').toUpperCase() as EmploymentType
  const monthlyIncome = body.monthlyIncome == null ? null : Number(body.monthlyIncome)
  const cibilScore = body.cibilScore == null ? null : Number(body.cibilScore)
  const source = String(body.source || '').toUpperCase() as SourceType

  // server-side validation
  const errors: Record<string, string> = {}

  if (fullName.length < 2) errors.fullName = 'Name must be at least 2 characters'
  if (!isValidMobile(mobile)) errors.mobile = 'Mobile must be 10 digits'
  if (email && !isValidEmail(email)) errors.email = 'Invalid email format'
  if (!['SALARIED', 'SELF_EMPLOYED'].includes(employmentType)) errors.employmentType = 'Invalid employment type'
  if (!['WALK_IN', 'REFERRAL', 'ONLINE', 'SOCIAL_MEDIA', 'OTHER'].includes(source)) errors.source = 'Invalid source'
  if (!isValidPAN(pan)) errors.pan = 'Invalid PAN format'
  if (monthlyIncome != null && !(monthlyIncome >= 0)) errors.monthlyIncome = 'Monthly income must be ≥ 0'
  if (cibilScore != null && !(Number.isInteger(cibilScore) && cibilScore >= 300 && cibilScore <= 900))
    errors.cibilScore = 'CIBIL must be 300–900'

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }

  // insert with tenant + creator attribution
  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    fullName,
    mobile,
    email,
    dob,
    pan,
    aadhaarMasked,
    address,
    employmentType,
    monthlyIncome,
    cibilScore,
    source,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    // duplicate mobile per-tenant handled by unique index
    const res = await db.collection('customers').insertOne(doc)

    
return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_mobile', message: 'Mobile already exists for this tenant' }, { status: 409 })
    }

    
return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}

