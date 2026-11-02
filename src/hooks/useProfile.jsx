import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY = 'profile'

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(() => cacheGet(CACHE_KEY))
  const [loading, setLoading] = useState(!cacheGet(CACHE_KEY))
  const [error, setError] = useState(null)

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      setError(error.message)
    } else {
      setProfile(data)
      cacheSet(CACHE_KEY, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  async function updateProfile(updates) {
    if (!user) return { error: 'Belum login' }
    // optimistic update
    const optimistic = { ...profile, ...updates }
    setProfile(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      // rollback
      setProfile(profile)
      cacheSet(CACHE_KEY, profile)
      return { error: error.message }
    }
    setProfile(data)
    cacheSet(CACHE_KEY, data)
    return { data }
  }

  return { profile, loading, error, updateProfile, refetch: fetchProfile }
}
