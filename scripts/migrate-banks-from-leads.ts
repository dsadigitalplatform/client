import fs from 'fs'
import path from 'path'

import { MongoClient, ObjectId } from 'mongodb'

import { migrateBanksFromLoanCases } from '@features/banks/server/migrateBanksFromLoanCases.server'

function readEnvValue(key: string) {
  const envPath = path.resolve(process.cwd(), '.env')
  const content = fs.readFileSync(envPath, 'utf8')
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'))

  return match ? match[1].trim() : ''
}

function withDbName(uri: string, dbName: string) {
  if (!uri) return ''
  const qIndex = uri.indexOf('?')

  if (qIndex >= 0) {
    return `${uri.slice(0, qIndex).replace(/\/+$/, '')}/${dbName}${uri.slice(qIndex)}`
  }

  return `${uri.replace(/\/+$/, '')}/${dbName}`
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
    $or: [{ bankName: { $type: 'string', $ne: '' } }, { bankCode: { $type: 'string', $ne: '' } }]
  })

  let totalImported = 0
  let totalSkipped = 0
  let totalScanned = 0

  for (const tenantId of tenantIds) {
    const tenantIdObj =
      tenantId instanceof ObjectId ? tenantId : ObjectId.isValid(String(tenantId)) ? new ObjectId(String(tenantId)) : null

    if (!tenantIdObj) continue

    const result = await migrateBanksFromLoanCases(db, tenantIdObj, tenantIdObj)

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
