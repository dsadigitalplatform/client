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
      updatedAt: { bsonType: 'date' },
      subscriptionPlanId: { bsonType: 'objectId' }
    },
    additionalProperties: true
  }
}

ensureCollection('tenants', tenantsValidator)

// Indexes
ensureIndex('tenants', { createdBy: 1 }, { name: 'idx_createdBy' })
ensureIndex('tenants', { status: 1 }, { name: 'idx_status' })
ensureIndex('tenants', { subscriptionPlanId: 1 }, { name: 'idx_subscriptionPlanId' })


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

const subscriptionPlansValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['name', 'slug', 'description', 'priceMonthly', 'maxUsers', 'createdAt', 'updatedAt'],
    properties: {
      name: { bsonType: 'string' },
      slug: { bsonType: 'string' },
      description: { bsonType: 'string' },
      priceMonthly: { bsonType: 'double' },
      priceYearly: { bsonType: ['double', 'null'] },
      currency: { bsonType: 'string' },
      maxUsers: { bsonType: 'int' },
      features: { bsonType: 'object' },
      isActive: { bsonType: 'bool' },
      isDefault: { bsonType: 'bool' },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: 'date' }
    },
    additionalProperties: true
  }
}

ensureCollection('subscriptionPlans', subscriptionPlansValidator)
ensureIndex('subscriptionPlans', { name: 1 }, { unique: true, name: 'uniq_subscriptionplan_name' })
ensureIndex('subscriptionPlans', { slug: 1 }, { unique: true, name: 'uniq_subscriptionplan_slug' })

const customersValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'fullName', 'mobile', 'employmentType', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      fullName: { bsonType: 'string', minLength: 2 },
      mobile: { bsonType: 'string', pattern: '^[0-9]{10}$' },
      email: { bsonType: ['string', 'null'], pattern: '^.+@.+\\..+$' },
      dob: { bsonType: ['date', 'null'] },
      pan: { bsonType: ['string', 'null'], pattern: '^[A-Z]{5}[0-9]{4}[A-Z]{1}$' },
      aadhaarMasked: { bsonType: ['string', 'null'] },
      address: { bsonType: ['string', 'null'] },
      employmentType: { enum: ['SALARIED', 'SELF_EMPLOYED'] },
      monthlyIncome: { bsonType: ['number', 'null'], minimum: 0 },
      cibilScore: { bsonType: ['int', 'null'], minimum: 300, maximum: 900 },
      source: { enum: ['WALK_IN', 'REFERRAL', 'ONLINE', 'SOCIAL_MEDIA', 'OTHER'] },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('customers', customersValidator)
ensureIndex('customers', { tenantId: 1 }, { name: 'idx_tenantId' })
ensureIndex('customers', { tenantId: 1, mobile: 1 }, { unique: true, name: 'uniq_tenant_mobile' })

const loanTypesValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'code', 'name', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      code: { bsonType: 'string', minLength: 2 },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('loanTypes', loanTypesValidator)
ensureIndex('loanTypes', { tenantId: 1 }, { name: 'idx_loanTypes_tenantId' })
ensureIndex('loanTypes', { tenantId: 1, code: 1 }, { unique: true, name: 'uniq_tenant_loanType_code' })

const documentChecklistsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'name', 'isActive', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      name: { bsonType: 'string', minLength: 2 },
      description: { bsonType: ['string', 'null'] },
      isActive: { bsonType: 'bool' },
      createdBy: { bsonType: ['objectId', 'null'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('documentChecklists', documentChecklistsValidator)
ensureIndex('documentChecklists', { tenantId: 1 }, { name: 'idx_documentChecklists_tenantId' })
ensureIndex('documentChecklists', { tenantId: 1, name: 1 }, { unique: true, name: 'uniq_tenant_documentChecklist_name' })

const loanTypeDocumentsValidator = {
  $jsonSchema: {
    bsonType: 'object',
    required: ['tenantId', 'loanTypeId', 'documentId', 'status', 'createdAt'],
    properties: {
      tenantId: { bsonType: 'objectId' },
      loanTypeId: { bsonType: 'objectId' },
      documentId: { bsonType: 'objectId' },
      status: { enum: ['REQUIRED', 'OPTIONAL', 'INACTIVE'] },
      createdAt: { bsonType: 'date' },
      updatedAt: { bsonType: ['date', 'null'] }
    },
    additionalProperties: true
  }
}

ensureCollection('loanTypeDocuments', loanTypeDocumentsValidator)
ensureIndex('loanTypeDocuments', { tenantId: 1 }, { name: 'idx_loanTypeDocuments_tenantId' })
ensureIndex(
  'loanTypeDocuments',
  { tenantId: 1, loanTypeId: 1, documentId: 1 },
  { unique: true, name: 'uniq_tenant_loanType_document' }
)

print('Database initialization complete.')

if (typeof module !== 'undefined' && module.exports) {
  const mongoose = require('mongoose')

  const SubscriptionPlanSchema = new mongoose.Schema(
    {
      name: { type: String, required: true, unique: true, trim: true },
      slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
      description: { type: String, required: true, trim: true },
      priceMonthly: { type: Number, required: true, min: 0 },
      priceYearly: { type: Number, min: 0 },
      currency: { type: String, default: 'USD' },
      maxUsers: { type: Number, required: true, min: 1 },
      features: { type: Map, of: Boolean, default: {} },
      isActive: { type: Boolean, default: true },
      isDefault: { type: Boolean, default: false }
    },
    { timestamps: true }
  )

  SubscriptionPlanSchema.index({ name: 1 }, { unique: true })
  SubscriptionPlanSchema.index({ slug: 1 }, { unique: true })
  SubscriptionPlanSchema.pre('save', function (next) {
    if (typeof this.name === 'string') this.name = this.name.trim()
    if (typeof this.slug === 'string') this.slug = this.slug.toLowerCase().trim()
    next()
  })

  const SubscriptionPlan =
    mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', SubscriptionPlanSchema)

  module.exports.SubscriptionPlan = SubscriptionPlan
}
