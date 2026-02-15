// Minimal verification script to list collections in the target database
// Reads MONGODB_URI from .env, appends '/dsa' before any query string, connects via mongodb driver, and prints collection names.
// No secrets are logged; only collection names are printed.
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
  if (!baseUri) {
    console.error('MONGODB_URI not found in .env')
    process.exit(1)
  }

  const dbName = process.env.MONGODB_DB_NAME || 'dsa'
  const uri = withDbName(baseUri, dbName)

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const db = client.db(dbName)

    const infos = await db.listCollections().toArray()
    const names = infos.map(i => i.name)

    console.log(JSON.stringify({ database: dbName, collections: names }))
  } catch (err) {
    console.error(err.message || String(err))
    process.exitCode = 1
  } finally {
    try {
      await client.close()
    } catch {}
  }
}

main()
