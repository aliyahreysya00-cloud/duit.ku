import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY = 'transactions'

export function useTransactions() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState(() => cacheGet(CACHE_KEY) ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTransactions = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) {
      setError(error.message)
    } else {
      setTransactions(data)
      cacheSet(CACHE_KEY, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  async function addTransaction(tx) {
    if (!user) return { error: 'Belum login' }
    const newTx = {
      ...tx,
      user_id: user.id,
      date: tx.date || new Date().toISOString().split('T')[0],
    }
    // optimistic
    const tempId = 'temp_' + Date.now()
    const optimisticTx = { ...newTx, id: tempId, created_at: new Date().toISOString() }
    const optimistic = [optimisticTx, ...transactions]
    setTransactions(optimistic)

    const { data, error } = await supabase
      .from('transactions')
      .insert(newTx)
      .select()
      .single()

    if (error) {
      setTransactions(transactions)
      return { error: error.message }
    }
    const updated = [data, ...transactions]
    setTransactions(updated)
    cacheSet(CACHE_KEY, updated)
    return { data }
  }

  async function deleteTransaction(id) {
    if (!user) return { error: 'Belum login' }
    const prev = transactions
    const optimistic = transactions.filter((t) => t.id !== id)
    setTransactions(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setTransactions(prev)
      cacheSet(CACHE_KEY, prev)
      return { error: error.message }
    }
    return { success: true }
  }

  return { transactions, loading, error, addTransaction, deleteTransaction, refetch: fetchTransactions }
}
