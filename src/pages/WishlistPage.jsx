import { useState, useMemo } from 'react'
import { useWishlist } from '../hooks/useWishlist'
import { usePockets } from '../hooks/usePockets'
import { useToast } from '../components/Toast'
import { formatRupiah } from '../lib/utils'

export default function WishlistPage() {
  const { wishlist, addWishlistItem, updateWishlistItem, deleteWishlistItem } = useWishlist()
  const { getPocketByName, updatePocketBalance } = usePockets()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', price: '', target_date: '', priority: 1 })
  const [submitting, setSubmitting] = useState(false)
  const [fundingItem, setFundingItem] = useState(null)
  const [fundAmount, setFundAmount] = useState('')

  const activeItems = wishlist.filter((w) => !w.is_completed).sort((a, b) => a.priority - b.priority)
  const completedItems = wishlist.filter((w) => w.is_completed)

  // Estimasi tabungan per minggu (dari saldo wishlist pocket / jumlah item)
  const wishlistPocket = getPocketByName('wishlist')
  const weeklyAvgSaving = wishlistPocket?.balance
    ? Math.round(wishlistPocket.balance / Math.max(activeItems.length, 1))
    : 0

  async function handleAddItem(e) {
    e.preventDefault()
    if (!form.name || !form.price) return
    setSubmitting(true)
    const { error } = await addWishlistItem({
      name: form.name,
      price: parseInt(form.price),
      target_date: form.target_date || null,
      priority: parseInt(form.priority) || 1,
    })
    setSubmitting(false)
    if (error) {
      toast('Gagal tambah wishlist 😢', 'error')
    } else {
      toast(`${form.name} masuk wishlist! ✨`, 'success')
      setForm({ name: '', price: '', target_date: '', priority: activeItems.length + 1 })
      setShowForm(false)
    }
  }

  async function handleFund(item) {
    const amount = parseInt(fundAmount)
    if (!amount || amount <= 0) return
    const pocket = getPocketByName('wishlist')
    if (!pocket) { toast('Pocket wishlist tidak ditemukan', 'error'); return }
    if (pocket.balance < amount) { toast('Saldo tabungan wishlist tidak cukup 🥲', 'error'); return }

    setSubmitting(true)
    const r1 = await updateWishlistItem(item.id, {
      saved_amount: Math.min(item.saved_amount + amount, item.price),
    })
    if (r1.error) { toast('Gagal update wishlist', 'error'); setSubmitting(false); return }

    await updatePocketBalance(pocket.id, pocket.balance - amount)

    // Cek apakah tercapai
    const newSaved = Math.min(item.saved_amount + amount, item.price)
    if (newSaved >= item.price) {
      await updateWishlistItem(item.id, { is_completed: true, saved_amount: item.price })
      toast(`🎉 ${item.name} udah terkumpul! Selamat!`, 'success')
    } else {
      toast(`+${formatRupiah(amount)} untuk ${item.name} 🐷`, 'success')
    }
    setSubmitting(false)
    setFundingItem(null)
    setFundAmount('')
  }

  async function handleDelete(id, name) {
    const { error } = await deleteWishlistItem(id)
    if (error) toast('Gagal hapus 😢', 'error')
    else toast(`${name} dihapus dari wishlist`, 'info')
  }

  function estimateWeeks(item) {
    const remaining = item.price - item.saved_amount
    if (weeklyAvgSaving <= 0 || remaining <= 0) return null
    return Math.ceil(remaining / weeklyAvgSaving)
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Wishlist ✨</h1>
      </header>

      <main className="page__content">
        {/* Saldo tabungan wishlist */}
        <section className="card card--lavender">
          <p className="card__label">Tabungan Wishlist</p>
          <p className="card__amount">{formatRupiah(wishlistPocket?.balance || 0)}</p>
          <p className="card__sub">{activeItems.length} item aktif</p>
        </section>

        {/* Tombol tambah */}
        <button
          className="btn btn--primary"
          style={{ width: '100%' }}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '✕ Batal' : '+ Tambah Wishlist'}
        </button>

        {/* Form tambah */}
        {showForm && (
          <form className="card" onSubmit={handleAddItem}>
            <div className="form-group">
              <label className="form-label" htmlFor="wl-name">Nama barang</label>
              <input
                id="wl-name"
                type="text"
                className="form-input"
                placeholder="Headphone baru 🎧"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wl-price">Harga (Rp)</label>
              <input
                id="wl-price"
                type="number"
                className="form-input"
                placeholder="0"
                min="1"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                required
                inputMode="numeric"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wl-date">Target tanggal (opsional)</label>
              <input
                id="wl-date"
                type="date"
                className="form-input"
                value={form.target_date}
                onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="wl-priority">Prioritas (1 = paling penting)</label>
              <input
                id="wl-priority"
                type="number"
                className="form-input"
                min="1"
                max="99"
                value={form.priority}
                onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Menambahkan...' : '✨ Tambah ke Wishlist'}
            </button>
          </form>
        )}

        {/* Wishlist aktif */}
        {activeItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__emoji">💭</span>
            <p>Wishlist masih kosong~</p>
            <p className="text-muted">Yuk tulis impianmu di sini!</p>
          </div>
        ) : (
          <section className="section">
            <h2 className="section__title">Lagi nabung untuk...</h2>
            <div className="wishlist-list">
              {activeItems.map((item) => {
                const pct = Math.min((item.saved_amount / item.price) * 100, 100)
                const weeks = estimateWeeks(item)
                const isFunding = fundingItem === item.id

                return (
                  <div key={item.id} className="wishlist-item-card">
                    <div className="wishlist-item-card__header">
                      <div>
                        <p className="wishlist-item-card__name">
                          <span className="wishlist-item-card__priority">#{item.priority}</span>
                          {item.name}
                        </p>
                        <p className="wishlist-item-card__price">{formatRupiah(item.price)}</p>
                      </div>
                      <button
                        className="btn btn--ghost btn--sm"
                        onClick={() => handleDelete(item.id, item.name)}
                        aria-label="Hapus wishlist"
                      >
                        ×
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="progress-bar" aria-label={`Progress ${item.name}: ${Math.round(pct)}%`}>
                      <div
                        className="progress-bar__fill progress-bar__fill--wishlist"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="wishlist-item-card__progress-info">
                      <span>{formatRupiah(item.saved_amount)} terkumpul</span>
                      <span>{Math.round(pct)}%</span>
                    </div>

                    {/* Info target & estimasi */}
                    {(item.target_date || weeks !== null) && (
                      <p className="text-muted" style={{ fontSize: '0.8rem', margin: '0.25rem 0' }}>
                        {item.target_date && `🎯 Target: ${new Date(item.target_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                        {weeks !== null && ` · ~${weeks} minggu lagi`}
                      </p>
                    )}

                    {/* Fund input */}
                    {isFunding ? (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="Jumlah (Rp)"
                          value={fundAmount}
                          onChange={(e) => setFundAmount(e.target.value)}
                          inputMode="numeric"
                          autoFocus
                        />
                        <button className="btn btn--primary btn--sm" disabled={submitting}
                          onClick={() => handleFund(item)}>✓</button>
                        <button className="btn btn--ghost btn--sm"
                          onClick={() => { setFundingItem(null); setFundAmount('') }}>✕</button>
                      </div>
                    ) : (
                      <button
                        className="btn btn--accent btn--sm"
                        style={{ marginTop: '0.5rem' }}
                        onClick={() => { setFundingItem(item.id); setFundAmount('') }}
                      >
                        🐷 Tambah tabungan
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Wishlist selesai */}
        {completedItems.length > 0 && (
          <section className="section">
            <h2 className="section__title">Sudah tercapai 🎉</h2>
            <div className="wishlist-list">
              {completedItems.map((item) => (
                <div key={item.id} className="wishlist-item-card wishlist-item-card--completed">
                  <div className="wishlist-item-card__header">
                    <div>
                      <p className="wishlist-item-card__name">✅ {item.name}</p>
                      <p className="wishlist-item-card__price">{formatRupiah(item.price)}</p>
                    </div>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => handleDelete(item.id, item.name)}
                      aria-label="Hapus"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
