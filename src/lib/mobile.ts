export const MOBILE_DIGITS_REGEX = /^[0-9]{8,10}$/

export const MOBILE_VALIDATION_MESSAGE = 'Enter an 8 to 10-digit mobile number'

export const normalizeMobileDigits = (value: string) => value.replace(/\D/g, '').slice(0, 10)

export const isValidMobileDigits = (value: string) => MOBILE_DIGITS_REGEX.test(value)
