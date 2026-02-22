export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'
import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'

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

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const currentTenantId = String((session as any).currentTenantId || '')
  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const row = await db.collection('customers').findOne({ _id: new ObjectId(id), tenantId: tenantIdObj })
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const data = {
    id: String((row as any)._id),
    fullName: (row as any).fullName || '',
    mobile: (row as any).mobile || '',
    email: (row as any).email ?? null,
    dob: (row as any).dob ? new Date((row as any).dob).toISOString() : null,
    pan: (row as any).pan ?? null,
    aadhaarMasked: (row as any).aadhaarMasked ?? null,
    address: (row as any).address ?? null,
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
  const currentTenantId = String((session as any).currentTenantId || '')
  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const body = await request.json().catch(() => ({}))

  const patch: any = {}
  if (body.fullName != null) patch.fullName = String(body.fullName).trim()
  if (body.mobile != null) patch.mobile = String(body.mobile).trim()
  if (body.email !== undefined) patch.email = body.email == null || String(body.email).trim().length === 0 ? null : String(body.email).trim()
  if (body.dob !== undefined) patch.dob = body.dob ? new Date(body.dob) : null
  if (body.pan !== undefined) patch.pan = body.pan ? String(body.pan).toUpperCase().trim() : null
  if (body.aadhaarMasked !== undefined) patch.aadhaarMasked = body.aadhaarMasked ? String(body.aadhaarMasked) : null
  if (body.address !== undefined) patch.address = body.address ? String(body.address) : null
  if (body.employmentType != null) patch.employmentType = String(body.employmentType).toUpperCase()
  if (body.monthlyIncome !== undefined) patch.monthlyIncome = body.monthlyIncome == null ? null : Number(body.monthlyIncome)
  if (body.cibilScore !== undefined) patch.cibilScore = body.cibilScore == null ? null : Number(body.cibilScore)
  if (body.source != null) patch.source = String(body.source).toUpperCase()
  patch.updatedAt = new Date()

  const errors: Record<string, string> = {}
  if (patch.fullName != null && patch.fullName.length < 2) errors.fullName = 'Name must be at least 2 characters'
  if (patch.mobile != null && !isValidMobile(patch.mobile)) errors.mobile = 'Mobile must be 10 digits'
  if (patch.email != null && !isValidEmail(patch.email)) errors.email = 'Invalid email format'
  if (patch.pan != null && !isValidPAN(patch.pan)) errors.pan = 'Invalid PAN format'
  if (patch.cibilScore != null && !(Number.isInteger(patch.cibilScore) && patch.cibilScore >= 300 && patch.cibilScore <= 900))
    errors.cibilScore = 'CIBIL must be 300–900'
  if (Object.keys(errors).length > 0) return NextResponse.json({ error: 'validation_error', details: errors }, { status: 400 })

  try {
    const res = await db
      .collection('customers')
      .updateOne({ _id: new ObjectId(id), tenantId: tenantIdObj }, { $set: patch })
    if (res.matchedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    if (err && err.code === 11000) {
      return NextResponse.json({ error: 'duplicate_mobile', message: 'Mobile already exists for this tenant' }, { status: 409 })
    }
    return NextResponse.json({ error: 'unknown_error' }, { status: 500 })
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  const currentTenantId = String((session as any).currentTenantId || '')
  if (!currentTenantId) return NextResponse.json({ error: 'tenant_required' }, { status: 400 })
  const db = await getDb()
  const tenantIdObj = new ObjectId(currentTenantId)
  const res = await db.collection('customers').deleteOne({ _id: new ObjectId(id), tenantId: tenantIdObj })
  if (res.deletedCount === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
