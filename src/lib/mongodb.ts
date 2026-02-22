import 'server-only'
import { MongoClient, type Db } from 'mongodb'

const uri = process.env.MONGODB_URI

if (!uri || uri.length === 0) {
  throw new Error('MONGODB_URI is missing in environment variables')
}

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>
}

const globalForMongo = globalThis as GlobalWithMongo

let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV !== 'production') {
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(uri)

    globalForMongo._mongoClientPromise = client.connect()
  }

  clientPromise = globalForMongo._mongoClientPromise as Promise<MongoClient>
} else {
  const client = new MongoClient(uri)

  clientPromise = client.connect()
}

export async function getClient(): Promise<MongoClient> {
  const client = await clientPromise

  return client
}

export async function getDb(dbName?: string): Promise<Db> {
  const client = await getClient()
  const name = dbName ?? process.env.MONGODB_DB_NAME ?? 'dsa'

  return client.db(name)
}
