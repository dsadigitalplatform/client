export type SupportedCurrency = {
  code: string
  name: string
  symbol: string
  locale?: string
}

/** Currencies available when creating/editing subscription plans. */
export const SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN' },
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU' },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'en-IE' },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', locale: 'en-SG' },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'en-AE' }
]

export const DEFAULT_CURRENCY = 'INR'

const codes = new Set(SUPPORTED_CURRENCIES.map(c => c.code))

export function isSupportedCurrency(code: unknown): code is string {
  return typeof code === 'string' && codes.has(code.trim().toUpperCase())
}

export function normalizeCurrency(code: unknown, fallback = DEFAULT_CURRENCY): string {
  if (typeof code !== 'string') return fallback
  const upper = code.trim().toUpperCase()

  return codes.has(upper) ? upper : fallback
}

export function getCurrencyMeta(code: string | null | undefined): SupportedCurrency {
  const normalized = normalizeCurrency(code)

  return SUPPORTED_CURRENCIES.find(c => c.code === normalized) || SUPPORTED_CURRENCIES[0]
}

export function formatPlanMoney(amount: number | null | undefined, currency?: string | null): string {
  if (amount == null || !Number.isFinite(amount)) return '—'

  const meta = getCurrencyMeta(currency)

  try {
    return new Intl.NumberFormat(meta.locale, {
      style: 'currency',
      currency: meta.code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
  } catch {
    return `${meta.symbol}${amount}`
  }
}
