import 'server-only'

import type { CodeEntityType, CodeTokenHint } from '@features/code-generation/code-generation.types'

export type EntityCodeMeta = {
  entityType: CodeEntityType
  label: string
  description: string
  collectionName: string
  codeField: string
  /** Create/update currently calls the generator for this entity */
  isWired: boolean
  defaultTemplate: string
  defaultPrefix: string
  defaultSequencePadLength: number
}

export const ENTITY_CODE_META: Record<CodeEntityType, EntityCodeMeta> = {
  LEAD: {
    entityType: 'LEAD',
    label: 'Lead',
    description: 'Business code for every lead in Lead Manager',
    collectionName: 'loanCases',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '{CUSTOMER_INITIALS}-{LOAN_TYPE}-{YYYYMMDD}-{SEQ:3}',
    defaultPrefix: 'LD',
    defaultSequencePadLength: 3
  },
  CUSTOMER: {
    entityType: 'CUSTOMER',
    label: 'Customer',
    description: 'Business code for customer master (auto-generated from template)',
    collectionName: 'customers',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '',
    defaultPrefix: 'CU',
    defaultSequencePadLength: 4
  },
  BANK: {
    entityType: 'BANK',
    label: 'Bank',
    description: 'Business code for bank master (auto-generated from template)',
    collectionName: 'banks',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '',
    defaultPrefix: 'BK',
    defaultSequencePadLength: 3
  },
  ASSOCIATE: {
    entityType: 'ASSOCIATE',
    label: 'Associate',
    description: 'Business code for associate master (auto-generated from template)',
    collectionName: 'associates',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '',
    defaultPrefix: 'AS',
    defaultSequencePadLength: 4
  },
  CORPORATE: {
    entityType: 'CORPORATE',
    label: 'Corporate',
    description: 'Business code for corporate master (auto-generated from template)',
    collectionName: 'corporates',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '',
    defaultPrefix: 'CO',
    defaultSequencePadLength: 4
  },
  LOAN_TYPE: {
    entityType: 'LOAN_TYPE',
    label: 'Loan type',
    description: 'Short code for loan types (auto-generated; used inside lead templates)',
    collectionName: 'loanTypes',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '',
    defaultPrefix: 'LT',
    defaultSequencePadLength: 3
  },
  ADVOCATE: {
    entityType: 'ADVOCATE',
    label: 'Advocate',
    description: 'Business code for advocate master (auto-generated from template)',
    collectionName: 'advocates',
    codeField: 'code',
    isWired: true,
    defaultTemplate: '',
    defaultPrefix: 'AD',
    defaultSequencePadLength: 4
  }
}

export const CODE_TOKEN_HINTS: CodeTokenHint[] = [
  { token: '{PREFIX}', label: 'Configured prefix', example: 'LD', entityTypes: 'ALL' },
  { token: '{YYYYMMDD}', label: 'Date YYYYMMDD', example: '20260730', entityTypes: 'ALL' },
  { token: '{YYYY}', label: 'Year', example: '2026', entityTypes: 'ALL' },
  { token: '{YY}', label: 'Year (2 digit)', example: '26', entityTypes: 'ALL' },
  { token: '{MM}', label: 'Month', example: '07', entityTypes: 'ALL' },
  { token: '{DD}', label: 'Day', example: '30', entityTypes: 'ALL' },
  { token: '{SEQ:3}', label: 'Sequence (padded)', example: '001', entityTypes: 'ALL' },
  { token: '{SEQ:4}', label: 'Sequence (4 digits)', example: '0001', entityTypes: 'ALL' },
  {
    token: '{CUSTOMER_INITIALS}',
    label: 'Customer name initials',
    example: 'RK',
    entityTypes: ['LEAD', 'CUSTOMER']
  },
  {
    token: '{LOAN_TYPE}',
    label: 'Loan type short code',
    example: 'HL',
    entityTypes: ['LEAD', 'LOAN_TYPE']
  },
  {
    token: '{BANK_CODE}',
    label: 'Bank code',
    example: 'HDFC',
    entityTypes: ['LEAD', 'BANK']
  },
  {
    token: '{COMPANY_NAME}',
    label: 'Company name short code',
    example: 'AFPL',
    entityTypes: ['ASSOCIATE']
  },
  {
    token: '{COMPANY_NAME:2}',
    label: 'Company name (2 chars)',
    example: 'AF',
    entityTypes: ['ASSOCIATE']
  },
  {
    token: '{INITIALS}',
    label: 'Record name initials',
    example: 'AB',
    entityTypes: ['ASSOCIATE', 'CORPORATE', 'ADVOCATE', 'CUSTOMER']
  }
]

export function isCodeEntityType(value: unknown): value is CodeEntityType {
  return typeof value === 'string' && value in ENTITY_CODE_META
}
