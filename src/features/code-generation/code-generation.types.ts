export const CODE_ENTITY_TYPES = [
  'LEAD',
  'CUSTOMER',
  'BANK',
  'ASSOCIATE',
  'CORPORATE',
  'LOAN_TYPE',
  'ADVOCATE'
] as const

export type CodeEntityType = (typeof CODE_ENTITY_TYPES)[number]

export type CodeGenerationConfig = {
  id: string
  entityType: CodeEntityType
  label: string
  description: string
  isEnabled: boolean
  /** Template with tokens like {PREFIX}, {YYYYMMDD}, {SEQ:4}, {CUSTOMER_INITIALS}, {LOAN_TYPE} */
  template: string
  /** Fixed prefix token value when {PREFIX} is used */
  prefix: string
  /** Pad length fallback when template uses bare {SEQ} */
  sequencePadLength: number
  /** Collection used for uniqueness checks */
  collectionName: string
  /** Field name on the document that stores the business code */
  codeField: string
  /** Whether create/update wiring is live for this entity */
  isWired: boolean
  samplePreview: string
  updatedAt: string | null
}

export type UpdateCodeGenerationConfigInput = {
  entityType: CodeEntityType
  template: string
  prefix: string
  sequencePadLength: number
}

export type CodeTokenHint = {
  token: string
  label: string
  example: string
  entityTypes: CodeEntityType[] | 'ALL'
}

export type ReapplyCodeResult = {
  entityType: CodeEntityType
  scanned: number
  updated: number
  skipped: number
  failed: number
  banksRepaired?: number
  errors: string[]
}
