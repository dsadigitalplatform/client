const fs = require('fs')
const path = require('path')

const { MongoClient, ObjectId } = require('mongodb')

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

function normalizeBankCode(code) {
  return code.trim().toLowerCase()
}

function escapeRegex(value) {
  return value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}

function generateBankCodeFromName(name) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)

  return base || 'bank'
}

async function findDuplicateBankCode(db, tenantIdObj, code) {
  return db.collection('banks').findOne({
    tenantId: tenantIdObj,
    codeNormalized: normalizeBankCode(code)
  })
}

async function ensureUniqueBankCode(db, tenantIdObj, baseCode) {
  let code = baseCode
  let suffix = 2

  while (await findDuplicateBankCode(db, tenantIdObj, code)) {
    code = `${baseCode}-${suffix}`
    suffix += 1
  }

  return code
}

async function migrateTenant(db, tenantIdObj) {
  const tenantIdHex = tenantIdObj.toHexString()

  const rows = await db
    .collection('loanCases')
    .aggregate([
      { $match: { tenantId: { $in: [tenantIdObj, tenantIdHex] }, bankName: { $type: 'string' } } },
      { $project: { bankName: { $trim: { input: '$bankName' } } } },
      { $match: { bankName: { $ne: '' } } },
      { $group: { _id: { $toLower: '$bankName' }, value: { $first: '$bankName' } } },
      { $sort: { value: 1 } }
    ])
    .toArray()

  let imported = 0
  let skipped = 0

  for (const row of rows) {
    const name = String(row.value || '').trim()

    if (!name) continue

    const existingByName = await db.collection('banks').findOne({
      tenantId: tenantIdObj,
      name: { $regex: `^${escapeRegex(name)}$`, $options: 'i' }
    })

    if (existingByName) {
      skipped += 1
      continue
    }

    const baseCode = generateBankCodeFromName(name)
    const code = await ensureUniqueBankCode(db, tenantIdObj, baseCode)
    const now = new Date()

    await db.collection('banks').insertOne({
      tenantId: tenantIdObj,
      code,
      codeNormalized: normalizeBankCode(code),
      name,
      description: 'Imported from lead manager',
      createdBy: null,
      createdAt: now,
      updatedAt: now
    })

    imported += 1
  }

  return { scanned: rows.length, imported, skipped }
}

async function main() {
  const baseUri = readEnvValue('MONGODB_URI')

  if (!baseUri) {
    throw new Error('MONGODB_URI not found in .env')
  }

  const dbName = readEnvValue('MONGODB_DB') || 'dsa'
  const uri = withDbName(baseUri, dbName)
  const client = new MongoClient(uri)

  await client.connect()
  const db = client.db()

  const tenantIds = await db.collection('loanCases').distinct('tenantId', {
    bankName: { $type: 'string', $ne: '' }
  })

  let totalImported = 0
  let totalSkipped = 0
  let totalScanned = 0

  for (const tenantId of tenantIds) {
    const tenantIdObj =
      tenantId instanceof ObjectId ? tenantId : ObjectId.isValid(String(tenantId)) ? new ObjectId(String(tenantId)) : null

    if (!tenantIdObj) continue

    const result = await migrateTenant(db, tenantIdObj)

    totalImported += result.imported
    totalSkipped += result.skipped
    totalScanned += result.scanned

    console.log(
      `Tenant ${tenantIdObj.toHexString()}: scanned=${result.scanned}, imported=${result.imported}, skipped=${result.skipped}`
    )
  }

  console.log(`Done. scanned=${totalScanned}, imported=${totalImported}, skipped=${totalSkipped}`)
  await client.close()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
