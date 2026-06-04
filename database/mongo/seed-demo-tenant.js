/**
 * Creates (or reuses) the shared demo tenant. Run once in dev, then set DEMO_TENANT_ID in .env.
 *
 * Usage: node database/mongo/seed-demo-tenant.js
 */
const fs = require('fs')
const path = require('path')

const { MongoClient, ObjectId } = require('mongodb')

function readEnvValue(key) {
  const envPath = path.resolve(process.cwd(), '.env')

  if (!fs.existsSync(envPath)) return ''

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

async function main() {
  const uri = readEnvValue('MONGODB_URI') || process.env.MONGODB_URI
  const dbName = readEnvValue('MONGODB_DB_NAME') || process.env.MONGODB_DB_NAME || 'dsa'
  const existingDemoTenantId = readEnvValue('DEMO_TENANT_ID') || process.env.DEMO_TENANT_ID

  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }

  const client = new MongoClient(withDbName(uri, dbName))

  await client.connect()
  const db = client.db(dbName)
  const now = new Date()

  if (existingDemoTenantId && ObjectId.isValid(existingDemoTenantId)) {
    const existing = await db.collection('tenants').findOne({ _id: new ObjectId(existingDemoTenantId) })

    if (existing) {
      await db.collection('tenants').updateOne(
        { _id: existing._id },
        { $set: { isDemo: true, name: existing.name || 'Demo Organisation', updatedAt: now } }
      )
      console.log(`Demo tenant already exists: ${existing._id.toHexString()}`)
      await client.close()

      return
    }
  }

  const superEmail = (readEnvValue('SUPER_ADMIN_EMAIL') || process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase()
  let createdBy = null

  if (superEmail) {
    const owner = await db.collection('users').findOne(
      { email: { $regex: `^${superEmail.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, $options: 'i' } },
      { projection: { _id: 1 } }
    )

    createdBy = owner?._id || null
  }

  if (!createdBy) {
    const anyUser = await db.collection('users').findOne({}, { projection: { _id: 1 }, sort: { createdAt: 1 } })

    createdBy = anyUser?._id || new ObjectId()
  }

  const insertTenant = await db.collection('tenants').insertOne({
    name: 'Demo Organisation',
    type: 'company',
    status: 'active',
    isDemo: true,
    createdBy,
    createdAt: now,
    updatedAt: now
  })

  const tenantId = insertTenant.insertedId.toHexString()

  console.log('Demo tenant created.')
  console.log(`Add to .env:\nENABLE_DEMO_LOGIN=true\nDEMO_TENANT_ID=${tenantId}`)

  await client.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
