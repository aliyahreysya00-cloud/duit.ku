import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY   = 'pockets'
const POCKET_NAMES = ['jajan', 'tabungan', 'wishlist']

export function usePockets() {
  const { user } = useAuth()
  const [pockets, setPockets] = useState(() => cacheGet(CACHE_KEY) ?? [])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  // ── Auto-create pockets ───────────────────────────────────
  async function ensurePockets(userId) {
    const { data: existing } = await supabase
      .from('pockets').select('name').eq('user_id', userId)
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
    await ensurePockets(user.id)
    const { data, error: e } = await supabase
      .from('pockets').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
    if (e) { setError(e.message); console.error('fetchPockets:', e) }
    else   { setPockets(data); cacheSet(CACHE_KEY, data) }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchPockets() }, [fetchPockets])

  // ── Catat history internal ────────────────────────────────
  async function _logHistory({ pocketId, pocketName, type, amount, source, note, balanceAfter }) {
    if (!user) return
    await supabase.from('pocket_history').insert({
      user_id:       user.id,
      pocket_id:     pocketId,
      pocket_name:   pocketName,
      type,
      amount,
      source,
      note:          note || null,
      balance_after: balanceAfter,
    })
  }

  // ── Update saldo ─────────────────────────────────────────
  async function updatePocketBalance(pocketId, newBalance, opts = {}) {
    if (!user)    return { error: 'User tidak ditemukan' }
    if (!pocketId) return { error: 'Pocket ID tidak valid' }

    const safe = Math.max(0, Math.round(newBalance))
    const prev = [...pockets]
    const oldPocket = pockets.find((p) => p.id === pocketId)
    const oldBal    = oldPocket?.balance ?? 0

    // Optimistic
    const optimistic = pockets.map((p) => p.id === pocketId ? { ...p, balance: safe } : p)
    setPockets(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { data, error } = await supabase
      .from('pockets')
      .update({ balance: safe, updated_at: new Date().toISOString() })
      .eq('id', pocketId).eq('user_id', user.id)
      .select().single()

    if (error) {
      console.error('updatePocketBalance:', error)
      setPockets(prev); cacheSet(CACHE_KEY, prev)
      return { error: error.message }
    }

    const updated = prev.map((p) => p.id === pocketId ? data : p)
    setPockets(updated); cacheSet(CACHE_KEY, updated)

    // Catat history jika ada opts.source
    if (opts.source && oldBal !== safe) {
      const diff = safe - oldBal
      await _logHistory({
        pocketId,
        pocketName:   oldPocket?.name || '',
        type:         diff > 0 ? 'in' : 'out',
        amount:       Math.abs(diff),
        source:       opts.source,
        note:         opts.note,
        balanceAfter: safe,
      })
    }

    return { data }
  }

  // ── Transfer atomik ───────────────────────────────────────
  async function transferBetweenPockets(fromId, toId, amount, opts = {}) {
    if (!user) return { error: 'User tidak ditemukan' }
    const fromP = pockets.find((p) => p.id === fromId)
    const toP   = pockets.find((p) => p.id === toId)
    if (!fromP || !toP)  return { error: 'Pocket tidak ditemukan' }
    if (fromP.balance < amount) return { error: 'Saldo tidak cukup' }

    const newFrom = fromP.balance - amount
    const newTo   = toP.balance   + amount
    const prev    = [...pockets]

    const optimistic = pockets.map((p) => {
      if (p.id === fromId) return { ...p, balance: newFrom }
      if (p.id === toId)   return { ...p, balance: newTo }
      return p
    })
    setPockets(optimistic); cacheSet(CACHE_KEY, optimistic)

    const [r1, r2] = await Promise.all([
      supabase.from('pockets').update({ balance: newFrom, updated_at: new Date().toISOString() })
        .eq('id', fromId).eq('user_id', user.id).select().single(),
      supabase.from('pockets').update({ balance: newTo, updated_at: new Date().toISOString() })
        .eq('id', toId).eq('user_id', user.id).select().single(),
    ])

    if (r1.error || r2.error) {
      setPockets(prev); cacheSet(CACHE_KEY, prev)
      return { error: r1.error?.message || r2.error?.message }
    }

    const final = prev.map((p) => {
      if (p.id === fromId) return r1.data
      if (p.id === toId)   return r2.data
      return p
    })
    setPockets(final); cacheSet(CACHE_KEY, final)

    // Catat history kedua sisi
    const sourceLabel = opts.source || `Transfer dari ${fromP.name}`
    await Promise.all([
      _logHistory({ pocketId: fromId, pocketName: fromP.name, type: 'out', amount, source: sourceLabel, note: opts.note, balanceAfter: newFrom }),
      _logHistory({ pocketId: toId,   pocketName: toP.name,   type: 'in',  amount, source: sourceLabel, note: opts.note, balanceAfter: newTo }),
    ])

    return { success: true }
  }

  function getPocketByName(name) {
    return pockets.find((p) => p.name === name) ?? null
  }

  return { pockets, loading, error, updatePocketBalance, transferBetweenPockets, getPocketByName, refetch: fetchPockets }
}
