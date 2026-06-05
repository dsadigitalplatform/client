export type CountryCodeOption = {
  code: string
  iso: string
  name: string
  flag: string
}

/** Select value that switches the control to manual (+ and up to 3 digits). */
export const COUNTRY_CODE_MANUAL_SELECT_VALUE = '__manual__'

export const COUNTRY_CODE_REGEX = /^\+[0-9]{1,3}$/

export const COUNTRY_CODE_VALIDATION_MESSAGE = 'Enter a valid country code (+ and 1–3 digits)'

export const COUNTRY_CODE_OPTIONS: CountryCodeOption[] = [
  { code: '+91', iso: 'IN', name: 'India', flag: '🇮🇳' },
  { code: '+966', iso: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', iso: 'AE', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: '+974', iso: 'QA', name: 'Qatar', flag: '🇶🇦' },
  { code: '+965', iso: 'KW', name: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', iso: 'BH', name: 'Bahrain', flag: '🇧🇭' },
  { code: '+968', iso: 'OM', name: 'Oman', flag: '🇴🇲' },
  { code: '+1', iso: 'US', name: 'United States', flag: '🇺🇸' },
  { code: '+44', iso: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+65', iso: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: '+61', iso: 'AU', name: 'Australia', flag: '🇦🇺' }
]

export const isPresetCountryCode = (code: string) => COUNTRY_CODE_OPTIONS.some(o => o.code === code)

export const getCountryCodeOption = (code: string) => {
  const match = COUNTRY_CODE_OPTIONS.find(o => o.code === code)

  if (match) return match

  if (isValidCountryCode(code)) {
    return { code, iso: 'XX', name: 'Custom', flag: '🌍' } satisfies CountryCodeOption
  }

  return COUNTRY_CODE_OPTIONS[0]
}

export const isValidCountryCode = (value: string) => COUNTRY_CODE_REGEX.test(value)

export const countryCodeToDigits = (value: string) => value.replace(/^\+/, '').replace(/\D/g, '').slice(0, 3)

export const digitsToCountryCode = (digits: string) => {
  const normalized = countryCodeToDigits(digits)

  return normalized.length > 0 ? `+${normalized}` : '+'
}
