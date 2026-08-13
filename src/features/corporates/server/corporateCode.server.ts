import type { Db, ObjectId } from 'mongodb'

import { generateBusinessCode } from '@features/code-generation/server/codeGenerator.server'

type GenerateCorporateCodeParams = {
  db: Db
  tenantId: ObjectId
  name: string
  preview?: boolean
  excludeId?: ObjectId
  date?: Date
}

/** Generate a corporate business code using the tenant CORPORATE code-generation template. */
export async function generateCorporateBusinessCode(params: GenerateCorporateCodeParams) {
  const { db, tenantId, name, preview, excludeId, date } = params
  const trimmedName = String(name || '').trim()

  return generateBusinessCode({
    db,
    tenantId,
    entityType: 'CORPORATE',
    context: {
      recordName: trimmedName,
      date: date || new Date()
    },
    preview,
    excludeId
  })
}
