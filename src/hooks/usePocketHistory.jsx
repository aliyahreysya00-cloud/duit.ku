import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function usePocketHistory(pocketId = null) {
  const { user } = useAuth()
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)

  const fetchHistory = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    let query = supabase
      .from('pocket_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (pocketId) {
      query = query.eq('pocket_id', pocketId)
    }

    const { data, error } = await query
    if (error) {
      setError(error.message)
      console.error('fetchHistory error:', error)
    } else {
      setHistory(data || [])
    }
    setLoading(false)
  }, [user, pocketId])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  /**
   * Catat mutasi saldo
   * @param {object} entry
   * @param {string} entry.pocket_id
   * @param {string} entry.pocket_name
   * @param {'in'|'out'} entry.type
   * @param {number} entry.amount
   * @param {string} entry.source  — label sumber, misal "Pemasukan Uang Saku"
   * @param {string} [entry.note]
   * @param {number} entry.balance_after
   */
  async function addHistory(entry) {
    if (!user) return { error: 'User tidak ditemukan' }

    const { data, error } = await supabase
      .from('pocket_history')
      .insert({ ...entry, user_id: user.id })
      .select()
      .single()

    if (error) {
      console.error('addHistory error:', error)
      return { error: error.message }
    }

    setHistory((prev) => [data, ...prev])
    return { data }
  }

  return { history, loading, error, addHistory, refetch: fetchHistory }
}
