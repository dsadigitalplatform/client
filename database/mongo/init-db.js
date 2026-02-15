// MongoDB Multi-tenant SaaS Schema Initialization (mongosh compatible)
// Safe to run multiple times; uses collMod for validators and checks for existing indexes.

// Helper: ensure collection exists and apply validator idempotently
function ensureCollection(name, validator) {
  const exists = db.getCollectionInfos({ name }).length > 0

  if (!exists) {
    db.createCollection(name, {
      validator,
      validationLevel: 'moderate',
      validationAction: 'error'
    })
    print(`Collection '${name}' created.`)
  } else if (validator) {
    db.runCommand({
      collMod: name,
      validator,
      validationLevel: 'moderate',
      validationAction: 'error'
    })
    print(`Collection '${name}' updated (validator).`)
  }
}

// Helper: compare index spec and options, then create if missing
function hasIndex(collName, keys, opts = {}) {
  const indexes = db.getCollection(collName).getIndexes()

  return indexes.some(idx => {
    const sameKeys =
      Object.keys(keys).length === Object.keys(idx.key).length &&
      Object.keys(keys).every(k => idx.key[k] === keys[k])

    if (!sameKeys) return false

    if (opts.unique && !idx.unique) return false

    if (opts.partialFilterExpression) {
      const a = JSON.stringify(opts.partialFilterExpression)
      const b = JSON.stringify(idx.partialFilterExpression || {})

      if (a !== b) return false
    }

    return true
  })
}

function ensureIndex(collName, keys, opts = {}) {
  if (!hasIndex(collName, keys, opts)) {
    db.getCollection(collName).createIndex(keys, opts)
    print(`Index created on '${collName}': ${JSON.stringify(keys)}`)
  } else {
    print(`Index already exists on '${collName}': ${JSON.stringify(keys)}`)
  }
}

/* =========================
   1) users
   Stores auth-independent user profile with email uniqueness.
   Supports super admin flag and status management.
   ========================= */
const usersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['email', 'name', 'status', 'createdAt', 'updatedAt'],
    properties: {
      email: { bsonType: 'string' },
      name: { bsonType: 'string' },
      avatarUrl: { bsonType: 'string' },
      isSuperAdmin: { bsonType: 'bool' },
      status: { enum: ['active', 'suspended'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('users', usersValidator)

// Indexes
ensureIndex('users', { email: 1 }, { unique: true, name: 'uniq_email' })


/* =========================
   2) authAccounts
   External and local auth account links per user.
   Supports Google now and Facebook / Apple / Email later.
   ========================= */
const authAccountsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['userId', 'provider', 'providerUserId', 'email', 'createdAt'],
    properties: {
      userId: { bsonType: 'objectId' },
      provider: { enum: ['google', 'facebook', 'apple', 'email'] },
      providerUserId: { bsonType: 'string' },
      email: { bsonType: 'string' },
      passwordHash: { bsonType: ['string', 'null'] },
      createdAt: { bsonType: 'date' },
      lastLoginAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('authAccounts', authAccountsValidator)

// Indexes
ensureIndex(
  'authAccounts',
  { provider: 1, providerUserId: 1 },
  { unique: true, name: 'uniq_provider_providerUserId' }
)
ensureIndex('authAccounts', { userId: 1 }, { name: 'idx_userId' })


/* =========================
   3) tenants
   Tenant entities representing organizations or sole traders.
   Created by a user; has type and status.
   ========================= */
const tenantsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'type', 'status', 'createdBy', 'createdAt', 'updatedAt'],
    properties: {
      name: { bsonType: 'string' },
      type: { enum: ['sole_trader', 'company'] },
      status: { enum: ['active', 'suspended'] },
      createdBy: { bsonType: 'objectId' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('tenants', tenantsValidator)

// Indexes
ensureIndex('tenants', { createdBy: 1 }, { name: 'idx_createdBy' })
ensureIndex('tenants', { status: 1 }, { name: 'idx_status' })


/* =========================
   4) memberships
   Links users to tenants with roles and invitation lifecycle.
   userId is nullable until invite accepted; uniqueness applies only when userId exists.
   ========================= */
const membershipsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'role', 'status', 'createdAt'],
    properties: {
      userId: { bsonType: ['objectId', 'null'] },
      tenantId: { bsonType: 'objectId' },
      role: { enum: ['OWNER', 'ADMIN', 'USER'] },
      status: { enum: ['invited', 'active', 'revoked'] },
      invitedBy: { bsonType: 'objectId' },
      invitedAt: { bsonType: 'date' },
      activatedAt: { bsonType: 'date' },
      createdAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('memberships', membershipsValidator)

// Indexes
// Unique when userId is set to prevent multiple active memberships for the same user/tenant
ensureIndex(
  'memberships',
  { userId: 1, tenantId: 1 },
  {
    unique: true,
    name: 'uniq_user_tenant_when_user_exists',
    partialFilterExpression: { userId: { $type: 'objectId' } }
  }
)
ensureIndex('memberships', { tenantId: 1 }, { name: 'idx_tenantId' })
ensureIndex('memberships', { userId: 1 }, { name: 'idx_userId' })
ensureIndex('memberships', { status: 1 }, { name: 'idx_status' })


/* =========================
   5) auditLogs
   Immutable audit trail for privileged actions across tenants.
   ========================= */
const auditLogsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['actorUserId', 'action', 'targetTenantId', 'createdAt'],
    properties: {
      actorUserId: { bsonType: 'objectId' },
      action: { enum: ['IMPERSONATE_START', 'IMPERSONATE_END', 'ADMIN_VIEW'] },
      targetTenantId: { bsonType: 'objectId' },
      metadata: { bsonType: 'object' },
      createdAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('auditLogs', auditLogsValidator)

// Indexes
ensureIndex('auditLogs', { actorUserId: 1 }, { name: 'idx_actorUserId' })
ensureIndex('auditLogs', { targetTenantId: 1 }, { name: 'idx_targetTenantId' })
ensureIndex('auditLogs', { action: 1 }, { name: 'idx_action' })

print('Database initialization complete.')
