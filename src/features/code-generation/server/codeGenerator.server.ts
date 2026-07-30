import 'server-only'

import { ObjectId } from 'mongodb'

import { ENTITY_CODE_META, isCodeEntityType } from '@features/code-generation/server/entityCodeMeta'
import type { CodeEntityType } from '@features/code-generation/code-generation.types'

export type CodeTokenContext = {
  customerName?: string | null
  loanTypeName?: string | null
  loanTypeCode?: string | null
  bankName?: string | null
  bankCode?: string | null
  companyName?: string | null
  recordName?: string | null
  /** Override date used for date tokens (defaults to now) */
  date?: Date
}

type StoredConfig = {
  _id?: ObjectId
  tenantId: ObjectId
  entityType: CodeEntityType
  isEnabled: boolean
  template: string
  prefix: string
  sequencePadLength: number
  updatedAt?: Date | null
  updatedBy?: ObjectId | null
}

const TEMPLATE_TOKEN_RE = /\{([A-Z0-9_]+)(?::(\d+))?\}/g

function sanitizeSegment(value: string, maxLen = 12) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '')
    .toUpperCase()
    .slice(0, maxLen)
}

export function initialsFromName(name: string | null | undefined, maxChars = 3) {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return 'XX'

  const initials = words
    .slice(0, maxChars)
    .map(w => w[0] || '')
    .join('')

  return sanitizeSegment(initials, maxChars) || 'XX'
}

export function shortCodeFromName(name: string | null | undefined, maxLen = 4) {
  const raw = String(name || '').trim()

  if (!raw) return 'X'

  const words = raw.split(/\s+/).filter(Boolean)

  if (words.length >= 2) {
    return sanitizeSegment(words.map(w => w[0] || '').join(''), maxLen) || 'X'
  }

  return sanitizeSegment(raw, maxLen) || 'X'
}

function pad(n: number, length: number) {
  return String(Math.max(0, n)).padStart(Math.max(1, length), '0')
}

function formatDateParts(date: Date) {
  const yyyy = String(date.getFullYear())
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')

  return {
    YYYYMMDD: `${yyyy}${mm}${dd}`,
    YYYY: yyyy,
    YY: yyyy.slice(-2),
    MM: mm,
    DD: dd
  }
}

export function resolveTokenValue(
  token: string,
  padLength: number | undefined,
  config: Pick<StoredConfig, 'prefix' | 'sequencePadLength'>,
  context: CodeTokenContext,
  sequenceValue: number
) {
  const dates = formatDateParts(context.date || new Date())
  const seqPad = padLength ?? config.sequencePadLength

  switch (token) {
    case 'PREFIX':
      return sanitizeSegment(config.prefix || '', 8) || 'X'
    case 'YYYYMMDD':
      return dates.YYYYMMDD
    case 'YYYY':
      return dates.YYYY
    case 'YY':
      return dates.YY
    case 'MM':
      return dates.MM
    case 'DD':
      return dates.DD
    case 'SEQ':
      return pad(sequenceValue, seqPad)
    case 'CUSTOMER_INITIALS':
      return initialsFromName(context.customerName)
    case 'LOAN_TYPE':
      return context.loanTypeCode
        ? sanitizeSegment(context.loanTypeCode, 6)
        : shortCodeFromName(context.loanTypeName, 4)
    case 'BANK_CODE':
      return context.bankCode
        ? sanitizeSegment(context.bankCode, 8)
        : shortCodeFromName(context.bankName, 6)
    case 'COMPANY_NAME':
      return shortCodeFromName(context.companyName, padLength ?? 4)
    case 'INITIALS':
      return initialsFromName(context.recordName || context.customerName)
    default:
      return ''
  }
}

export function renderTemplate(
  template: string,
  config: Pick<StoredConfig, 'prefix' | 'sequencePadLength'>,
  context: CodeTokenContext,
  sequenceValue: number
) {
  const rendered = template.replace(TEMPLATE_TOKEN_RE, (_, token: string, padRaw?: string) => {
    const padLength = padRaw ? Number(padRaw) : undefined

    return resolveTokenValue(token, padLength, config, context, sequenceValue)
  })

  return rendered
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase()
}

export function getEffectiveTemplate(
  config: Pick<StoredConfig, 'template' | 'prefix' | 'sequencePadLength'>,
  defaultSequencePadLength = 3
) {
  const trimmed = String(config.template || '').trim()

  if (trimmed) return trimmed

  const pad = Number(config.sequencePadLength) || defaultSequencePadLength

  return `{PREFIX}-{SEQ:${pad}}`
}

export function validateTemplate(template: string) {
  const trimmed = String(template || '').trim()

  if (!trimmed) return null
  if (trimmed.length > 80) return 'Template must be at most 80 characters'

  const tokens = [...trimmed.matchAll(TEMPLATE_TOKEN_RE)].map(m => m[1])
  const known = new Set([
    'PREFIX',
    'YYYYMMDD',
    'YYYY',
    'YY',
    'MM',
    'DD',
    'SEQ',
    'CUSTOMER_INITIALS',
    'LOAN_TYPE',
    'BANK_CODE',
    'COMPANY_NAME',
    'INITIALS'
  ])

  for (const token of tokens) {
    if (!known.has(token)) return `Unknown token {${token}}`
  }

  if (!tokens.includes('SEQ')) {
    return 'Template must include a {SEQ} or {SEQ:n} token for uniqueness'
  }

  return null
}

export async function getOrCreateCodeConfig(db: any, tenantId: ObjectId, entityType: CodeEntityType) {
  const meta = ENTITY_CODE_META[entityType]
  const existing = (await db.collection('codeGenerationConfigs').findOne({
    tenantId,
    entityType
  })) as StoredConfig | null

  if (existing) return existing

  const now = new Date()
  const doc: StoredConfig = {
    tenantId,
    entityType,
    isEnabled: true,
    template: '',
    prefix: meta.defaultPrefix,
    sequencePadLength: meta.defaultSequencePadLength,
    updatedAt: now,
    updatedBy: null
  }

  try {
    const res = await db.collection('codeGenerationConfigs').insertOne(doc)

    return { ...doc, _id: res.insertedId }
  } catch {
    const again = (await db.collection('codeGenerationConfigs').findOne({
      tenantId,
      entityType
    })) as StoredConfig | null

    if (again) return again
    throw new Error('Failed to initialize code generation config')
  }
}

async function nextSequenceValue(
  db: any,
  tenantId: ObjectId,
  entityType: CodeEntityType,
  scopeKey: string
) {
  const res = await db.collection('codeSequences').findOneAndUpdate(
    { tenantId, entityType, scopeKey },
    {
      $inc: { nextValue: 1 },
      $setOnInsert: { tenantId, entityType, scopeKey, createdAt: new Date() },
      $set: { updatedAt: new Date() }
    },
    { upsert: true, returnDocument: 'after' }
  )

  const doc = (res as any)?.value ?? res
  const nextValue = Number(doc?.nextValue ?? 1)

  return Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 1
}

function sequenceScopeKey(template: string, context: CodeTokenContext) {
  const dates = formatDateParts(context.date || new Date())

  // Scope sequences by day when the template includes a day token; otherwise tenant-wide.
  if (template.includes('{YYYYMMDD}') || template.includes('{DD}')) return dates.YYYYMMDD
  if (template.includes('{YYYY}')) return dates.YYYY
  if (template.includes('{YY}')) return dates.YY

  return 'GLOBAL'
}

export async function generateBusinessCode(params: {
  db: any
  tenantId: ObjectId
  entityType: CodeEntityType
  context: CodeTokenContext
  /** When previewing, do not consume sequence */
  preview?: boolean
  excludeId?: ObjectId
  /** Optional unsaved overrides (preview / draft) */
  overrides?: Partial<Pick<StoredConfig, 'template' | 'prefix' | 'sequencePadLength'>>
}) {
  const { db, tenantId, entityType, context, preview = false, excludeId, overrides } = params

  if (!isCodeEntityType(entityType)) throw new Error('invalid_entity_type')

  const meta = ENTITY_CODE_META[entityType]
  const stored = await getOrCreateCodeConfig(db, tenantId, entityType)
  const config: StoredConfig = {
    ...stored,
    template: overrides?.template ?? stored.template,
    prefix: overrides?.prefix ?? stored.prefix,
    sequencePadLength: overrides?.sequencePadLength ?? stored.sequencePadLength,
    isEnabled: true
  }

  const template = getEffectiveTemplate(config, meta.defaultSequencePadLength)
  const scopeKey = sequenceScopeKey(template, context)

  for (let attempt = 0; attempt < 25; attempt++) {
    const sequenceValue = preview
      ? Number((await db.collection('codeSequences').findOne({ tenantId, entityType, scopeKey }))?.nextValue || 0) + 1
      : await nextSequenceValue(db, tenantId, entityType, scopeKey)

    const code = renderTemplate(template, config, context, sequenceValue)

    if (!code) continue

    if (preview) return code

    const filter: Record<string, unknown> = { tenantId, [meta.codeField]: code }

    if (excludeId) filter._id = { $ne: excludeId }

    const clash = await db.collection(meta.collectionName).findOne(filter, { projection: { _id: 1 } })

    if (!clash) return code
  }

  // Last-resort unique suffix
  const fallbackSeq = Date.now().toString().slice(-6)
  const fallback = renderTemplate(template, config, context, Number(fallbackSeq.slice(-4)) || 1)

  return `${fallback}-${fallbackSeq}`.replace(/-+/g, '-').toUpperCase()
}

export async function listCodeConfigsForTenant(db: any, tenantId: ObjectId) {
  const entityTypes = Object.keys(ENTITY_CODE_META) as CodeEntityType[]
  const rows = []

  for (const entityType of entityTypes) {
    const config = await getOrCreateCodeConfig(db, tenantId, entityType)
    const meta = ENTITY_CODE_META[entityType]
    const effectiveTemplate = getEffectiveTemplate(config, meta.defaultSequencePadLength)
    const sampleContext =
      entityType === 'BANK'
        ? {
            recordName: 'HDFC Bank',
            bankName: 'HDFC Bank',
            date: new Date()
          }
        : entityType === 'ASSOCIATE'
          ? {
              recordName: 'Rajesh Kumar',
              companyName: 'Alpha Finance Pvt Ltd',
              date: new Date()
            }
          : entityType === 'CUSTOMER'
            ? {
                recordName: 'Rajesh Kumar',
                customerName: 'Rajesh Kumar',
                date: new Date()
              }
            : entityType === 'CORPORATE'
              ? {
                  recordName: 'Alpha Corp Pvt Ltd',
                  date: new Date()
                }
              : entityType === 'LOAN_TYPE'
                ? {
                    recordName: 'Home Loan',
                    loanTypeName: 'Home Loan',
                    date: new Date()
                  }
                : entityType === 'ADVOCATE'
                  ? {
                      recordName: 'Rajesh Kumar',
                      date: new Date()
                    }
                  : {
            customerName: 'Rajesh Kumar',
            loanTypeName: 'Home Loan',
            loanTypeCode: 'HL',
            bankName: 'HDFC Bank',
            bankCode: 'HDFC',
            recordName: 'Rajesh Kumar',
            date: new Date()
          }
    const samplePreview = renderTemplate(effectiveTemplate, config, sampleContext, 1)

    rows.push({
      id: config._id ? String(config._id) : `${entityType}`,
      entityType,
      label: meta.label,
      description: meta.description,
      isEnabled: true,
      template: config.template,
      prefix: config.prefix || meta.defaultPrefix,
      sequencePadLength: Number(config.sequencePadLength || meta.defaultSequencePadLength),
      collectionName: meta.collectionName,
      codeField: meta.codeField,
      isWired: meta.isWired,
      samplePreview,
      updatedAt: config.updatedAt ? new Date(config.updatedAt).toISOString() : null
    })
  }

  return rows
}
