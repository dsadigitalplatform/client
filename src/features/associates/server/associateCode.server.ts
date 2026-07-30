import type { Db, ObjectId } from 'mongodb'

import { generateBusinessCode } from '@features/code-generation/server/codeGenerator.server'

type GenerateAssociateCodeParams = {
  db: Db
  tenantId: ObjectId
  associateName: string
  companyName: string
  preview?: boolean
  excludeId?: ObjectId
  date?: Date
}

/** Generate an associate business code using the tenant ASSOCIATE code-generation template. */
export async function generateAssociateBusinessCode(params: GenerateAssociateCodeParams) {
  const { db, tenantId, associateName, companyName, preview, excludeId, date } = params

  return generateBusinessCode({
    db,
    tenantId,
    entityType: 'ASSOCIATE',
    context: {
      recordName: String(associateName || '').trim(),
      companyName: String(companyName || '').trim(),
      date: date || new Date()
    },
    preview,
    excludeId
  })
}
