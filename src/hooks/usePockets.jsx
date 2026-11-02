import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY = 'pockets'

export function usePockets() {
  const { user } = useAuth()
  const [pockets, setPockets] = useState(() => cacheGet(CACHE_KEY) ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchPockets = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('pockets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    if (error) { setError(error.message) }
    else { setPockets(data); cacheSet(CACHE_KEY, data) }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchPockets() }, [fetchPockets])

  // Update saldo satu pocket
  async function updatePocketBalance(pocketId, newBalance) {
    if (!user) return { error: 'Belum login' }
    const safeBalance = Math.max(0, Math.round(newBalance))
    const prev = [...pockets]
    const optimistic = pockets.map((p) => p.id === pocketId ? { ...p, balance: safeBalance } : p)
    setPockets(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { data, error } = await supabase
      .from('pockets')
      .update({ balance: safeBalance, updated_at: new Date().toISOString() })
      .eq('id', pocketId).eq('user_id', user.id)
      .select().single()

    if (error) { setPockets(prev); cacheSet(CACHE_KEY, prev); return { error: error.message } }
    const updated = pockets.map((p) => p.id === pocketId ? data : p)
    setPockets(updated); cacheSet(CACHE_KEY, updated)
    return { data }
  }

  // Transfer dari satu pocket ke pocket lain atomik
  async function transferBetweenPockets(fromId, toId, amount) {
    if (!user) return { error: 'Belum login' }
    const fromPocket = pockets.find((p) => p.id === fromId)
    const toPocket   = pockets.find((p) => p.id === toId)
    if (!fromPocket || !toPocket) return { error: 'Pocket tidak ditemukan' }
    if (fromPocket.balance < amount) return { error: 'Saldo tidak cukup' }

    const newFrom = fromPocket.balance - amount
    const newTo   = toPocket.balance + amount

    // Optimistic update keduanya sekaligus
    const optimistic = pockets.map((p) => {
      if (p.id === fromId) return { ...p, balance: newFrom }
      if (p.id === toId)   return { ...p, balance: newTo }
      return p
    })
    setPockets(optimistic); cacheSet(CACHE_KEY, optimistic)

    const [r1, r2] = await Promise.all([
      supabase.from('pockets').update({ balance: newFrom, updated_at: new Date().toISOString() })
        .eq('id', fromId).eq('user_id', user.id).select().single(),
      supabase.from('pockets').update({ balance: newTo,   updated_at: new Date().toISOString() })
        .eq('id', toId).eq('user_id', user.id).select().single(),
    ])

    if (r1.error || r2.error) {
      // rollback
      const rollback = pockets
      setPockets(rollback); cacheSet(CACHE_KEY, rollback)
      return { error: r1.error?.message || r2.error?.message }
    }
    const final = pockets.map((p) => {
      if (p.id === fromId) return r1.data
      if (p.id === toId)   return r2.data
      return p
    })
    setPockets(final); cacheSet(CACHE_KEY, final)
    return { success: true }
  }

  function getPocketByName(name) {
    return pockets.find((p) => p.name === name)
  }

  return { pockets, loading, error, updatePocketBalance, transferBetweenPockets, getPocketByName, refetch: fetchPockets }
}
