import 'server-only'

import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'

export function isDemoLoginEnabled(): boolean {
  return process.env.ENABLE_DEMO_LOGIN === 'true' && Boolean(getDemoTenantIdOrNull())
}

export function getDemoTenantIdOrNull(): string | null {
  const raw = process.env.DEMO_TENANT_ID?.trim()

  if (!raw || !ObjectId.isValid(raw)) return null

  return raw
}

export function getDemoTenantId(): string {
  const id = getDemoTenantIdOrNull()

  if (!id) {
    throw new Error('DEMO_TENANT_ID is missing or invalid')
  }

  return id
}

export async function ensureDemoMembership(userId: string, email?: string): Promise<string> {
  if (!isDemoLoginEnabled()) {
    throw Object.assign(new Error('demo_login_disabled'), { status: 403 })
  }

  const demoTenantId = getDemoTenantId()
  const db = await getDb()
  const tenantIdObj = new ObjectId(demoTenantId)
  const userIdObj = new ObjectId(userId)
  const now = new Date()

  const tenant = await db.collection('tenants').findOne(
    { _id: tenantIdObj, isDemo: true, status: 'active' },
    { projection: { _id: 1 } }
  )

  if (!tenant) {
    throw Object.assign(new Error('demo_tenant_not_configured'), { status: 500 })
  }

  const existing = await db.collection('memberships').findOne({ userId: userIdObj, tenantId: tenantIdObj })

  if (existing) {
    if (String((existing as any).status) !== 'active') {
      await db.collection('memberships').updateOne(
        { _id: (existing as any)._id },
        {
          $set: {
            status: 'active',
            activatedAt: now,
            updatedAt: now
          },
          $unset: { inviteToken: '', expiresAt: '' }
        }
      )
    }

    return demoTenantId
  }

  await db.collection('memberships').insertOne({
    userId: userIdObj,
    tenantId: tenantIdObj,
    role: 'USER',
    status: 'active',
    ...(email ? { email: email.trim().toLowerCase() } : {}),
    activatedAt: now,
    createdAt: now,
    updatedAt: now
  })

  return demoTenantId
}

export function applyDemoSessionToToken(token: Record<string, unknown>, demoTenantId: string) {
  token.currentTenantId = demoTenantId
  token.tenantIds = [demoTenantId]
  token.isDemoMode = true
}
