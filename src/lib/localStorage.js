/**
 * Cache helper untuk optimistic UI.
 * Data Supabase di-cache di localStorage supaya app
 * langsung tampil saat dibuka, lalu sync di background.
 */

const PREFIX = 'duitku_'

export function cacheSet(key, data) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ data, ts: Date.now() }))
  } catch {
    // storage penuh atau private mode — lewati saja
  }
}

export function cacheGet(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return null
    const { data } = JSON.parse(raw)
    return data
  } catch {
    return null
  }
}

export function cacheRemove(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function cacheClear() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k))
  } catch {
    // ignore
  }
}
