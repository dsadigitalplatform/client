import type { Db, ObjectId } from 'mongodb'

import { generateBusinessCode } from '@features/code-generation/server/codeGenerator.server'

type GenerateAdvocateCodeParams = {
  db: Db
  tenantId: ObjectId
  name: string
  preview?: boolean
  excludeId?: ObjectId
  date?: Date
}

/** Generate an advocate business code using the tenant ADVOCATE code-generation template. */
export async function generateAdvocateBusinessCode(params: GenerateAdvocateCodeParams) {
  const { db, tenantId, name, preview, excludeId, date } = params
  const trimmedName = String(name || '').trim()

  return generateBusinessCode({
    db,
    tenantId,
    entityType: 'ADVOCATE',
    context: {
      recordName: trimmedName,
      date: date || new Date()
    },
    preview,
    excludeId
  })
}
