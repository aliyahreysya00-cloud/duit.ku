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

    if (error) {
      setError(error.message)
    } else {
      setPockets(data)
      cacheSet(CACHE_KEY, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchPockets()
  }, [fetchPockets])

  async function updatePocketBalance(pocketId, newBalance) {
    if (!user) return { error: 'Belum login' }
    const prev = pockets
    const optimistic = pockets.map((p) =>
      p.id === pocketId ? { ...p, balance: newBalance } : p
    )
    setPockets(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { data, error } = await supabase
      .from('pockets')
      .update({ balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', pocketId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      setPockets(prev)
      cacheSet(CACHE_KEY, prev)
      return { error: error.message }
    }
    const updated = pockets.map((p) => (p.id === pocketId ? data : p))
    setPockets(updated)
    cacheSet(CACHE_KEY, updated)
    return { data }
  }

  function getPocketByName(name) {
    return pockets.find((p) => p.name === name)
  }

  return { pockets, loading, error, updatePocketBalance, getPocketByName, refetch: fetchPockets }
}
