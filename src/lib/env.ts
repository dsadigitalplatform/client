import 'server-only'

function getRequiredEmailEnv(name: string): string {
  const value = process.env[name]

  if (!value || typeof value !== 'string') {
    throw new Error(`${name} is missing`)
  }

  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error(`${name} cannot be empty`)
  }

  return trimmed
}

export function getSuperAdminEmail(): string {
  return getRequiredEmailEnv('SUPER_ADMIN_EMAIL')
}

export function getAdminEmail(): string {
  return getRequiredEmailEnv('ADMIN_EMAIL')
}

export function getSupportRecipientEmails(): string[] {
  const admin = getAdminEmail()
  const superAdmin = getSuperAdminEmail()

  return Array.from(
    new Set(
      [admin, superAdmin]
        .join(',')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
    )
  )
}
