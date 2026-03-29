'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import type { UserProfile } from '../profile.types'
import { getProfile } from '../services/profileService'

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getProfile()

      setProfile(data as UserProfile)
    } catch (err: any) {
      setProfile(null)
      setError(err?.message || 'Failed to load profile')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return useMemo(
    () => ({
      profile,
      loading,
      error,
      refresh
    }),
    [profile, loading, error, refresh]
  )
}
