import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { cacheGet, cacheSet } from '../lib/localStorage'
import { useAuth } from './useAuth'

const CACHE_KEY = 'wishlist'

export function useWishlist() {
  const { user } = useAuth()
  const [wishlist, setWishlist] = useState(() => cacheGet(CACHE_KEY) ?? [])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchWishlist = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('wishlist_items')
      .select('*')
      .eq('user_id', user.id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      setWishlist(data)
      cacheSet(CACHE_KEY, data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchWishlist()
  }, [fetchWishlist])

  async function addWishlistItem(item) {
    if (!user) return { error: 'Belum login' }
    const newItem = { ...item, user_id: user.id, saved_amount: 0, is_completed: false }

    const tempId = 'temp_' + Date.now()
    const optimistic = [...wishlist, { ...newItem, id: tempId, created_at: new Date().toISOString() }]
    setWishlist(optimistic)

    const { data, error } = await supabase
      .from('wishlist_items')
      .insert(newItem)
      .select()
      .single()

    if (error) {
      setWishlist(wishlist)
      return { error: error.message }
    }
    const updated = [...wishlist, data]
    setWishlist(updated)
    cacheSet(CACHE_KEY, updated)
    return { data }
  }

  async function updateWishlistItem(id, updates) {
    if (!user) return { error: 'Belum login' }
    const prev = wishlist
    const optimistic = wishlist.map((w) => (w.id === id ? { ...w, ...updates } : w))
    setWishlist(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { data, error } = await supabase
      .from('wishlist_items')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      setWishlist(prev)
      cacheSet(CACHE_KEY, prev)
      return { error: error.message }
    }
    const updated = wishlist.map((w) => (w.id === id ? data : w))
    setWishlist(updated)
    cacheSet(CACHE_KEY, updated)
    return { data }
  }

  async function deleteWishlistItem(id) {
    if (!user) return { error: 'Belum login' }
    const prev = wishlist
    const optimistic = wishlist.filter((w) => w.id !== id)
    setWishlist(optimistic)
    cacheSet(CACHE_KEY, optimistic)

    const { error } = await supabase
      .from('wishlist_items')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      setWishlist(prev)
      cacheSet(CACHE_KEY, prev)
      return { error: error.message }
    }
    return { success: true }
  }

  return {
    wishlist,
    loading,
    error,
    addWishlistItem,
    updateWishlistItem,
    deleteWishlistItem,
    refetch: fetchWishlist,
  }
}
