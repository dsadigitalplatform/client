export const dynamic = 'force-dynamic' // ensure fresh data per request
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

type EmploymentType = 'SALARIED' | 'SELF_EMPLOYED'
type SourceType = 'WALK_IN' | 'REFERRAL' | 'ONLINE' | 'SOCIAL_MEDIA' | 'OTHER'
type SecondaryContactType = 'ALTERNATE' | 'SPOUSE' | 'FRIEND' | 'RELATIVE' | 'OTHER'

// basic validators for payload fields
function isValidEmail(v: unknown) {
  return typeof v === 'string' && /^.+@.+\..+$/.test(v)
}

function isValidCountryCode(v: unknown) {
  return typeof v === 'string' && /^\+[0-9]{1,4}$/.test(v)
}

function isValidMobile(v: unknown) {
  return typeof v === 'string' && /^[0-9]{9,10}$/.test(v)
}

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


// convert any 12+ digit input to masked Aadhaar
function maskAadhaar(input: unknown) {
  if (input == null) return null
  const digits = String(input).replace(/\D/g, '')

  if (digits.length < 4) return null
  const last4 = digits.slice(-4)

  
return `XXXX-XXXX-${last4}`
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

export async function GET(request: Request) {
  // auth + tenant guard
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

  // resolve membership to gate data
  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q') || ''
  const mobileParam = url.searchParams.get('mobile') || ''

  const baseFilter: any = { tenantId: tenantIdObj }

  if (mobileParam) {
    const normalized = String(mobileParam).trim()

    if (!isValidMobile(normalized)) {
      return NextResponse.json({ error: 'invalid_mobile' }, { status: 400 })
    }

    const row = await db.collection('customers').findOne({ ...baseFilter, mobile: normalized })

    if (!row) return NextResponse.json({ customer: null })

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

    return NextResponse.json({ customer: data })
  }

  if (q && q.trim().length > 0) {
    const safe = q.trim().replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

    baseFilter.$or = [
      { fullName: { $regex: safe, $options: 'i' } },
      { email: { $regex: safe, $options: 'i' } },
      { mobile: { $regex: safe } }
    ]
  }

  // projection for table
  const rows = await db
    .collection('customers')
    .find(baseFilter, {
      projection: {
        fullName: 1,
        countryCode: 1,
        mobile: 1,
        isNRI: 1,
        email: 1,
        remarks: 1,
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

  const customerIdStrings = rows.map(r => String((r as any)._id)).filter(Boolean)
  const tenantIdHex = tenantIdObj.toHexString()
  const requestedAmountByCustomer = new Map<string, number>()

  if (customerIdStrings.length > 0) {
    const leadSums = await db
      .collection('loanCases')
      .aggregate([
        {
          $match: {
            tenantId: { $in: [tenantIdObj, tenantIdHex] }
          }
        },
        {
          $project: {
            customerIdStr: { $toString: '$customerId' },
            requestedAmountNum: {
              $convert: {
                input: '$requestedAmount',
                to: 'double',
                onError: 0,
                onNull: 0
              }
            }
          }
        },
        {
          $match: {
            customerIdStr: { $in: customerIdStrings }
          }
        },
        {
          $group: {
            _id: '$customerIdStr',
            totalRequestedAmount: { $sum: '$requestedAmountNum' }
          }
        }
      ])
      .toArray()

    leadSums.forEach(row => {
      const customerId = String((row as any)?._id || '')
      const totalRequestedAmount = Number((row as any)?.totalRequestedAmount || 0)

      requestedAmountByCustomer.set(customerId, totalRequestedAmount)
    })
  }

  const customers = rows.map(r => ({
    id: String((r as any)._id),
    fullName: String((r as any).fullName || ''),
    countryCode: isValidCountryCode((r as any).countryCode) ? String((r as any).countryCode) : '+91',
    mobile: String((r as any).mobile || ''),
    isNRI: Boolean((r as any).isNRI),
    email: (r as any).email ? String((r as any).email) : null,
    remarks: (r as any).remarks ? String((r as any).remarks) : null,
    employmentType: String((r as any).employmentType || '') as EmploymentType,
    monthlyIncome: (r as any).monthlyIncome ?? null,
    cibilScore: (r as any).cibilScore ?? null,
    source: String((r as any).source || '') as SourceType,
    requestedLeadAmountTotal: requestedAmountByCustomer.get(String((r as any)._id)) || 0,
    createdAt: (r as any).createdAt ? new Date((r as any).createdAt).toISOString() : null
  }))

  return NextResponse.json({ customers })
}

export async function POST(request: Request) {
  // auth + tenant guard
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

  // ensure user belongs to tenant
  const membership = await db
    .collection('memberships')
    .findOne({ tenantId: tenantIdObj, status: 'active', $or: orFilters }, { projection: { role: 1 } })

  if (!membership) return NextResponse.json({ error: 'not_member' }, { status: 403 })

  // parse + normalize payload
  const body = await request.json().catch(() => ({}))

  const fullName = String(body.fullName || '').trim()
  const countryCode = body.countryCode == null ? '+91' : String(body.countryCode).trim()
  const mobile = String(body.mobile || '').trim()
  const isNRI = Boolean(body.isNRI)
  const email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  const dob = body.dob ? new Date(body.dob) : null
  const pan = body.pan ? String(body.pan).toUpperCase().trim() : null
  const aadhaarMasked = body.aadhaarMasked ? maskAadhaar(body.aadhaarMasked) : null
  const address = body.address ? String(body.address).trim() : null

  const remarks =
    body.remarks == null || String(body.remarks).trim().length === 0 ? null : String(body.remarks).trim()

  const employmentType = String(body.employmentType || '').toUpperCase() as EmploymentType
  const monthlyIncome = body.monthlyIncome == null ? null : Number(body.monthlyIncome)
  const cibilScore = body.cibilScore == null ? null : Number(body.cibilScore)
  const source = String(body.source || '').toUpperCase() as SourceType
  const secondaryContactsResult = parseSecondaryContacts(body.secondaryContacts)
  const secondaryContacts = secondaryContactsResult.contacts

  // server-side validation
  const errors: Record<string, string> = {}

  if (fullName.length < 2) errors.fullName = 'Name must be at least 2 characters'
  if (!isValidCountryCode(countryCode)) errors.countryCode = 'Invalid country code'
  if (!isValidMobile(mobile)) errors.mobile = 'Mobile must be 9 or 10 digits'
  if (email && !isValidEmail(email)) errors.email = 'Invalid email format'
  if (!['SALARIED', 'SELF_EMPLOYED'].includes(employmentType)) errors.employmentType = 'Invalid employment type'
  if (!['WALK_IN', 'REFERRAL', 'ONLINE', 'SOCIAL_MEDIA', 'OTHER'].includes(source)) errors.source = 'Invalid source'
  if (!isValidPAN(pan)) errors.pan = 'Invalid PAN format'
  if (remarks != null && remarks.length > 500) errors.remarks = 'Remarks must be ≤ 500 characters'
  if (monthlyIncome != null && !(monthlyIncome >= 0)) errors.monthlyIncome = 'Monthly income must be ≥ 0'
  if (cibilScore != null && !(Number.isInteger(cibilScore) && cibilScore >= 300 && cibilScore <= 900))
    errors.cibilScore = 'CIBIL must be 300–900'

  Object.assign(errors, secondaryContactsResult.errors)

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })
  }



  // insert with tenant + creator attribution
  const now = new Date()

  const doc: any = {
    tenantId: tenantIdObj,
    fullName,
    countryCode,
    mobile,
    isNRI,
    email,
    dob,
    pan,
    aadhaarMasked,
    address,
    remarks,
    employmentType,
    monthlyIncome,
    cibilScore,
    source,
    secondaryContacts,
    createdBy: userId,
    createdAt: now,
    updatedAt: now
  }

  try {
    // duplicate mobile per-tenant handled by unique index
    const res = await db.collection('customers').insertOne(doc)

    
return NextResponse.json({ id: res.insertedId.toHexString() }, { status: 201 })
  } catch (err: any) {
    if (err && err.code === 121) {
      return NextResponse.json({ error: 'validation_error', message: 'Customer creation failed validation' }, { status: 400 })
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

