export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

import { getServerSession } from 'next-auth'
import { ObjectId } from 'mongodb'

import { authOptions } from '@/lib/auth'
import { getDb } from '@/lib/mongodb'
import { resolveCurrentTenantId } from '@/lib/tenantSession'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/

async function requireOwnerTenant() {
  const session = await getServerSession(authOptions)

  if (!session?.userId) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) }

  const store = await cookies()
  const cookieTenantId = store.get('CURRENT_TENANT_ID')?.value || ''
  const tenantIdRaw = resolveCurrentTenantId(session as any, cookieTenantId)

  if (!tenantIdRaw || !ObjectId.isValid(tenantIdRaw)) {
    return { error: NextResponse.json({ error: 'tenant_required' }, { status: 400 }) }
  }

  const db = await getDb()
  const tenantId = new ObjectId(tenantIdRaw)
  const actorUserId = new ObjectId(session.userId)
  const email = String((session as any)?.user?.email || '')
  const isSuperAdmin = Boolean((session as any)?.isSuperAdmin || (session as any)?.user?.isSuperAdmin)

  const emailFilter =
    email && email.length > 0
      ? { email: { $regex: `^${email.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } }
      : undefined

  const orFilters = [{ userId: actorUserId }] as any[]

  if (emailFilter) orFilters.push(emailFilter)

  const membership = await db.collection('memberships').findOne(
    { tenantId, status: 'active', $or: orFilters },
    { projection: { role: 1 } }
  )

  const role = (membership?.role as string | undefined) || null
  const canEdit = role === 'OWNER' || role === 'ADMIN' || isSuperAdmin

  if (!membership && !isSuperAdmin) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }
  }

  return { db, tenantId, canEdit }
}

function billingProfileFromTenant(tenant: Record<string, any>) {
  return {
    legalName: tenant.legalName ?? null,
    gstin: tenant.gstin ?? null,
    pan: tenant.pan ?? null,
    billingEmail: tenant.billingEmail ?? null,
    billingPhone: tenant.billingPhone ?? null,
    billingAddress: tenant.billingAddress ?? null,
    placeOfSupplyStateCode: tenant.placeOfSupplyStateCode ?? null
  }
}

export async function GET() {
  const ctx = await requireOwnerTenant()

  if ('error' in ctx) return ctx.error

  const tenant = await ctx.db.collection('tenants').findOne({ _id: ctx.tenantId })

  if (!tenant) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({
    profile: billingProfileFromTenant(tenant as any),
    canEdit: ctx.canEdit
  })
}

export async function PATCH(req: Request) {
  const ctx = await requireOwnerTenant()

  if ('error' in ctx) return ctx.error

  if (!ctx.canEdit) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: any

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const update: Record<string, unknown> = { updatedAt: new Date() }

  if (body.legalName !== undefined) {
    update.legalName =
      typeof body.legalName === 'string' && body.legalName.trim() ? body.legalName.trim().slice(0, 200) : null
  }

  if (body.gstin !== undefined) {
    const g = typeof body.gstin === 'string' ? body.gstin.trim().toUpperCase() : ''

    if (g && !GSTIN_RE.test(g)) {
      return NextResponse.json({ error: 'invalid_gstin', message: 'Invalid GSTIN format' }, { status: 400 })
    }

    update.gstin = g || null
  }

  if (body.pan !== undefined) {
    const p = typeof body.pan === 'string' ? body.pan.trim().toUpperCase() : ''

    if (p && !PAN_RE.test(p)) {
      return NextResponse.json({ error: 'invalid_pan', message: 'Invalid PAN format' }, { status: 400 })
    }

    update.pan = p || null
  }

  if (body.billingEmail !== undefined) {
    update.billingEmail =
      typeof body.billingEmail === 'string' && body.billingEmail.trim()
        ? body.billingEmail.trim().toLowerCase()
        : null
  }

  if (body.billingPhone !== undefined) {
    update.billingPhone =
      typeof body.billingPhone === 'string' && body.billingPhone.trim() ? body.billingPhone.trim() : null
  }

  if (body.placeOfSupplyStateCode !== undefined) {
    update.placeOfSupplyStateCode =
      typeof body.placeOfSupplyStateCode === 'string' && body.placeOfSupplyStateCode.trim()
        ? body.placeOfSupplyStateCode.trim()
        : null
  }

  if (body.billingAddress !== undefined) {
    if (body.billingAddress === null) {
      update.billingAddress = null
    } else if (typeof body.billingAddress === 'object') {
      const a = body.billingAddress
      const line1 = typeof a.line1 === 'string' ? a.line1.trim() : ''

      if (!line1) {
        return NextResponse.json(
          { error: 'invalid_address', message: 'Billing address line1 is required' },
          { status: 400 }
        )
      }

      update.billingAddress = {
        line1,
        line2: typeof a.line2 === 'string' && a.line2.trim() ? a.line2.trim() : null,
        city: typeof a.city === 'string' ? a.city.trim() : '',
        state: typeof a.state === 'string' ? a.state.trim() : '',
        stateCode: typeof a.stateCode === 'string' ? a.stateCode.trim() : '',
        pincode: typeof a.pincode === 'string' ? a.pincode.trim() : '',
        country: typeof a.country === 'string' && a.country.trim() ? a.country.trim() : 'IN'
      }

      if (!update.placeOfSupplyStateCode && (update.billingAddress as any).stateCode) {
        update.placeOfSupplyStateCode = (update.billingAddress as any).stateCode
      }
    }
  }

  await ctx.db.collection('tenants').updateOne({ _id: ctx.tenantId }, { $set: update })
  const tenant = await ctx.db.collection('tenants').findOne({ _id: ctx.tenantId })

  return NextResponse.json({ profile: billingProfileFromTenant(tenant as any), canEdit: true })
}
