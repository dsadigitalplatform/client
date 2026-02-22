import 'server-only'

export function getSuperAdminEmail(): string {
  const value = process.env.SUPER_ADMIN_EMAIL

  if (!value || typeof value !== 'string') {
    throw new Error('SUPER_ADMIN_EMAIL is missing')
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error('SUPER_ADMIN_EMAIL cannot be empty')
  }

  return trimmed
}
