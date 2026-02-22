import { ObjectId } from 'mongodb'

import { getDb } from '@/lib/mongodb'

export type CreateTenantInput = {
  name: string
  type: 'sole_trader' | 'company'
  createdById: string
}

export async function createTenant(input: CreateTenantInput) {
  const db = await getDb()
  const now = new Date()
  const createdBy = new ObjectId(input.createdById)

  const insertTenant = await db.collection('tenants').insertOne({
    name: input.name,
    type: input.type,
    status: 'active',
    createdBy,
    createdAt: now,
    updatedAt: now
  })

  const tenantId = insertTenant.insertedId

  await db.collection('memberships').insertOne({
    userId: createdBy,
    tenantId,
    role: 'OWNER',
    status: 'active',
    activatedAt: now,
    createdAt: now
  })

  return { tenantId: tenantId.toHexString() }
}
