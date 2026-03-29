import type { UpdateProfileInput } from '../profile.types'

export async function getProfile() {
  const res = await fetch('/api/profile', { cache: 'no-store' })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')

    throw new Error(errText || `Failed to fetch profile (${res.status})`)
  }

  const data = await res.json().catch(() => ({}))

  return data?.profile
}

export async function updateProfile(body: UpdateProfileInput) {
  const res = await fetch('/api/profile', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const err = new Error(data?.message || data?.error || 'Failed to update profile') as any

    if (data?.details) err.details = data.details
    throw err
  }

  return data?.profile
}
