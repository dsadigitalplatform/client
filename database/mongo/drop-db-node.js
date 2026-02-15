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

async function main() {
  const baseUri = readEnvValue('MONGODB_URI')
  const dbName = process.env.MONGODB_DB_NAME || 'dsa'
  const uri = withDbName(baseUri, dbName)

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db(dbName)
  const res = await db.dropDatabase()
  console.log(JSON.stringify(res))
  await client.close()
}

main().catch(err => {
  console.error(err.message || String(err))
  process.exit(1)
})

