const fs = require('fs')
const path = require('path')

const { MongoClient } = require('mongodb')

async function main() {
  ;

(() => {
    for (const fname of ['.env.local', '.env']) {
      const p = path.resolve(process.cwd(), fname)

      if (fs.existsSync(p)) {
        const txt = fs.readFileSync(p, 'utf8')

        for (const line of txt.split(/\r?\n/)) {
          const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)

          if (m) {
            const key = m[1]
            let val = m[2]

            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
            if (!(key in process.env)) process.env[key] = val
          }
        }

        break
      }
    }
  })()

  const argv = process.argv.slice(2)
  const hasYes = argv.includes('--yes') || process.env.CLEAR_DB_CONFIRM === 'yes'

  const dbArg = (() => {
    const i = argv.indexOf('--db')

    
return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined
  })()

  const onlyArg = (() => {
    const i = argv.indexOf('--only')

    
return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined
  })()

  const uri = process.env.MONGODB_URI

  if (!uri) {
    console.error('MONGODB_URI is required')
    process.exit(1)
  }

  const dbName = dbArg || process.env.MONGODB_DB_NAME || 'dsa'

  if (!hasYes) {
    console.error('Pass --yes or set CLEAR_DB_CONFIRM=yes to proceed')
    process.exit(1)
  }

  const client = new MongoClient(uri)

  await client.connect()
  const db = client.db(dbName)
  let names

  if (onlyArg) {
    names = onlyArg.split(',').map(s => s.trim()).filter(Boolean)
  } else {
    const infos = await db.listCollections({}, { nameOnly: true }).toArray()

    names = infos.map(i => i.name).filter(n => !n.startsWith('system.'))
  }

  const results = {}

  for (const name of names) {
    const coll = db.collection(name)
    const before = await coll.countDocuments({})
    const del = await coll.deleteMany({})
    const after = await coll.countDocuments({})

    results[name] = { before, deleted: del.deletedCount || 0, after }
  }

  console.log(JSON.stringify({ uriMasked: uri.replace(/:\/\/([^@]+)@/, '://***@'), dbName, results }, null, 2))
  await client.close()
}

main().catch(err => {
  console.error(err && err.message ? err.message : String(err))
  process.exit(1)
})
