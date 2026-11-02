import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY = 'pockets'
const POCKET_NAMES = ['jajan', 'tabungan', 'wishlist']

export function usePockets() {
  const { user } = useAuth()
  const [pockets, setPockets]   = useState(() => cacheGet(CACHE_KEY) ?? [])
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)

  // ── Auto-create pockets jika belum ada ───────────────────
  async function ensurePockets(userId) {
    const { data: existing } = await supabase
      .from('pockets')
      .select('name')
      .eq('user_id', userId)

    const existingNames = (existing || []).map((p) => p.name)
    const missing = POCKET_NAMES.filter((n) => !existingNames.includes(n))

    if (missing.length > 0) {
      await supabase.from('pockets').insert(
        missing.map((name) => ({ user_id: userId, name, balance: 0 }))
      )
    }
  }

  const fetchPockets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    // Pastikan pockets ada dulu
    await ensurePockets(user.id)

    const { data, error: fetchErr } = await supabase
      .from('pockets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (fetchErr) {
      setError(fetchErr.message)
      console.error('fetchPockets error:', fetchErr)
    } else {
      setPockets(data)
      cacheSet(CACHE_KEY, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchPockets() }, [fetchPockets])

  // ── Update saldo ─────────────────────────────────────────
  async function updatePocketBalance(pocketId, newBalance) {
    if (!user) return { error: 'User tidak ditemukan' }
    if (!pocketId) return { error: 'Pocket ID tidak valid' }

    const safeBalance = Math.max(0, Math.round(newBalance))
    const prev = [...pockets]

    // Optimistic
    const optimistic = pockets.map((p) => p.id === pocketId ? { ...p, balance: safeBalance } : p)
    setPockets(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { data, error } = await supabase
      .from('pockets')
      .update({ balance: safeBalance, updated_at: new Date().toISOString() })
      .eq('id', pocketId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('updatePocketBalance error:', error)
      setPockets(prev)
      cacheSet(CACHE_KEY, prev)
      return { error: error.message }
    }

    const updated = prev.map((p) => p.id === pocketId ? data : p)
    setPockets(updated)
    cacheSet(CACHE_KEY, updated)
    return { data }
  }

  // ── Transfer atomik ───────────────────────────────────────
  async function transferBetweenPockets(fromId, toId, amount) {
    if (!user) return { error: 'User tidak ditemukan' }
    const fromP = pockets.find((p) => p.id === fromId)
    const toP   = pockets.find((p) => p.id === toId)
    if (!fromP || !toP) return { error: 'Pocket tidak ditemukan' }
    if (fromP.balance < amount) return { error: 'Saldo tidak cukup' }

    const newFrom = fromP.balance - amount
    const newTo   = toP.balance   + amount
    const prev    = [...pockets]

    const optimistic = pockets.map((p) => {
      if (p.id === fromId) return { ...p, balance: newFrom }
      if (p.id === toId)   return { ...p, balance: newTo }
      return p
    })
    setPockets(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const [r1, r2] = await Promise.all([
      supabase.from('pockets')
        .update({ balance: newFrom, updated_at: new Date().toISOString() })
        .eq('id', fromId).eq('user_id', user.id).select().single(),
      supabase.from('pockets')
        .update({ balance: newTo, updated_at: new Date().toISOString() })
        .eq('id', toId).eq('user_id', user.id).select().single(),
    ])

    if (r1.error || r2.error) {
      setPockets(prev)
      cacheSet(CACHE_KEY, prev)
      return { error: r1.error?.message || r2.error?.message }
    }

    const final = prev.map((p) => {
      if (p.id === fromId) return r1.data
      if (p.id === toId)   return r2.data
      return p
    })
    setPockets(final)
    cacheSet(CACHE_KEY, final)
    return { success: true }
  }

  function getPocketByName(name) {
    return pockets.find((p) => p.name === name) ?? null
  }

  return {
    pockets, loading, error,
    updatePocketBalance,
    transferBetweenPockets,
    getPocketByName,
    refetch: fetchPockets,
  }
}
