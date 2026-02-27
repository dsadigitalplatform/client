const fs = require('fs')
const path = require('path')

const { MongoClient } = require('mongodb')

function readEnvValue(key) {
  const envPath = path.resolve(process.cwd(), '.env')
  const content = fs.readFileSync(envPath, 'utf8')
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'))

  
return match ? match[1].trim() : ''
}

function withDbName(uri, dbName) {
  if (!uri) return ''
  const qIndex = uri.indexOf('?')

  if (qIndex >= 0) {
    return `${uri.slice(0, qIndex).replace(/\/+$/, '')}/${dbName}${uri.slice(qIndex)}`
  }

  
return `${uri.replace(/\/+$/, '')}/${dbName}`
}

async function ensureCollection(db, name, validator) {
  const exists = (await db.listCollections({ name }).toArray()).length > 0

  if (!exists) {
    await db.createCollection(name, {
      validator,
      validationLevel: 'moderate',
      validationAction: 'error'
    })
  } else if (validator) {
    await db.command({
      collMod: name,
      validator,
      validationLevel: 'moderate',
      validationAction: 'error'
    })
  }
}

function sameKeys(a, b) {
  const ak = Object.keys(a)
  const bk = Object.keys(b)

  if (ak.length !== bk.length) return false

  for (const k of ak) {
    if (b[k] !== a[k]) return false
  }

  
return true
}

async function hasIndex(coll, keys, opts = {}) {
  const indexes = await coll.listIndexes().toArray()

  
return indexes.some(idx => {
    if (!sameKeys(keys, idx.key)) return false
    if (opts.unique && !idx.unique) return false

    if (opts.partialFilterExpression) {
      const a = JSON.stringify(opts.partialFilterExpression)
      const b = JSON.stringify(idx.partialFilterExpression || {})

      if (a !== b) return false
    }

    
return true
  })
}

async function ensureIndex(coll, keys, opts = {}) {
  if (!(await hasIndex(coll, keys, opts))) {
    await coll.createIndex(keys, opts)
  }
}

async function main() {
  const baseUri = readEnvValue('MONGODB_URI')

  if (!baseUri) {
    throw new Error('MONGODB_URI not found in .env')
  }

  const dbName = process.env.MONGODB_DB_NAME || 'dsa'
  const uri = withDbName(baseUri, dbName)
  const client = new MongoClient(uri)

  await client.connect()
  const db = client.db(dbName)

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

  await ensureCollection(db, 'users', usersValidator)
  await ensureIndex(db.collection('users'), { email: 1 }, { unique: true, name: 'uniq_email' })

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

  await ensureCollection(db, 'authAccounts', authAccountsValidator)
  await ensureIndex(
    db.collection('authAccounts'),
    { provider: 1, providerUserId: 1 },
    { unique: true, name: 'uniq_provider_providerUserId' }
  )
  await ensureIndex(db.collection('authAccounts'), { userId: 1 }, { name: 'idx_userId' })

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

  await ensureCollection(db, 'tenants', tenantsValidator)
  await ensureIndex(db.collection('tenants'), { createdBy: 1 }, { name: 'idx_createdBy' })
  await ensureIndex(db.collection('tenants'), { status: 1 }, { name: 'idx_status' })

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

  await ensureCollection(db, 'memberships', membershipsValidator)
  await ensureIndex(
    db.collection('memberships'),
    { userId: 1, tenantId: 1 },
    {
      unique: true,
      name: 'uniq_user_tenant_when_user_exists',
      partialFilterExpression: { userId: { $type: 'objectId' } }
    }
  )
  await ensureIndex(db.collection('memberships'), { tenantId: 1 }, { name: 'idx_tenantId' })
  await ensureIndex(db.collection('memberships'), { userId: 1 }, { name: 'idx_userId' })
  await ensureIndex(db.collection('memberships'), { status: 1 }, { name: 'idx_status' })

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

  await ensureCollection(db, 'auditLogs', auditLogsValidator)
  await ensureIndex(db.collection('auditLogs'), { actorUserId: 1 }, { name: 'idx_actorUserId' })
  await ensureIndex(db.collection('auditLogs'), { targetTenantId: 1 }, { name: 'idx_targetTenantId' })
  await ensureIndex(db.collection('auditLogs'), { action: 1 }, { name: 'idx_action' })

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

  await ensureCollection(db, 'customers', customersValidator)
  await ensureIndex(db.collection('customers'), { tenantId: 1 }, { name: 'idx_tenantId' })
  await ensureIndex(
    db.collection('customers'),
    { tenantId: 1, mobile: 1 },
    { unique: true, name: 'uniq_tenant_mobile' }
  )

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

  await ensureCollection(db, 'loanTypes', loanTypesValidator)
  await ensureIndex(db.collection('loanTypes'), { tenantId: 1 }, { name: 'idx_loanTypes_tenantId' })
  await ensureIndex(
    db.collection('loanTypes'),
    { tenantId: 1, code: 1 },
    { unique: true, name: 'uniq_tenant_loanType_code' }
  )

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

  await ensureCollection(db, 'documentChecklists', documentChecklistsValidator)
  await ensureIndex(db.collection('documentChecklists'), { tenantId: 1 }, { name: 'idx_documentChecklists_tenantId' })
  await ensureIndex(
    db.collection('documentChecklists'),
    { tenantId: 1, name: 1 },
    { unique: true, name: 'uniq_tenant_documentChecklist_name' }
  )

  const loanStatusPipelineStagesValidator = {
    $jsonSchema: {
      bsonType: 'object',
      required: ['tenantId', 'name', 'order', 'createdAt'],
      properties: {
        tenantId: { bsonType: 'objectId' },
        name: { bsonType: 'string', minLength: 2 },
        description: { bsonType: ['string', 'null'] },
        order: { bsonType: 'number', minimum: 1, multipleOf: 1 },
        createdBy: { bsonType: ['objectId', 'null'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: ['date', 'null'] }
      },
      additionalProperties: true
    }
  }

  await ensureCollection(db, 'loanStatusPipelineStages', loanStatusPipelineStagesValidator)
  await ensureIndex(
    db.collection('loanStatusPipelineStages'),
    { tenantId: 1 },
    { name: 'idx_loanStatusPipelineStages_tenantId' }
  )
  await ensureIndex(
    db.collection('loanStatusPipelineStages'),
    { tenantId: 1, name: 1 },
    { unique: true, name: 'uniq_tenant_loanStatusPipelineStage_name' }
  )
  await ensureIndex(
    db.collection('loanStatusPipelineStages'),
    { tenantId: 1, order: 1 },
    { name: 'idx_tenant_loanStatusPipelineStage_order' }
  )

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

  await ensureCollection(db, 'loanTypeDocuments', loanTypeDocumentsValidator)
  await ensureIndex(db.collection('loanTypeDocuments'), { tenantId: 1 }, { name: 'idx_loanTypeDocuments_tenantId' })
  await ensureIndex(
    db.collection('loanTypeDocuments'),
    { tenantId: 1, loanTypeId: 1, documentId: 1 },
    { unique: true, name: 'uniq_tenant_loanType_document' }
  )

  await client.close()
}

main().catch(err => {
  console.error(err.message || String(err))
  process.exit(1)
})

