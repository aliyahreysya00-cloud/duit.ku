import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY = 'profile'

const DEFAULT_PROFILE = {
  transport_amount: 14000,
  lunch_amount:     15000,
  dinner_amount:    20000,
  wfh_days:         [3],
  saving_percent:   20,
}

export function useProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(() => cacheGet(CACHE_KEY) ?? DEFAULT_PROFILE)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Auto-create profile jika belum ada ───────────────────
  async function ensureProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) return null

    if (!data) {
      // Belum ada — insert baru
      const { data: created, error: insertErr } = await supabase
        .from('profiles')
        .insert({ id: userId, ...DEFAULT_PROFILE })
        .select()
        .single()

      if (insertErr) {
        console.error('ensureProfile insert error:', insertErr)
        return null
      }
      return created
    }
    return data
  }

  const fetchProfile = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    const data = await ensureProfile(user.id)
    if (data) {
      setProfile(data)
      cacheSet(CACHE_KEY, data)
    } else {
      setError('Gagal load profile')
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  // ── Update profile ────────────────────────────────────────
  async function updateProfile(updates) {
    if (!user) return { error: 'User tidak ditemukan' }

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
      console.error('updateProfile error:', error)
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
