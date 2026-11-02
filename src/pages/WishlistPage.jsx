import { useState, useMemo } from 'react'
import { useWishlist } from '../hooks/useWishlist'
import { usePockets } from '../hooks/usePockets'
import { useToast } from '../components/Toast'
import { formatRupiah } from '../lib/utils'

export default function WishlistPage() {
  const { wishlist, addWishlistItem, updateWishlistItem, deleteWishlistItem } = useWishlist()
  const { getPocketByName, transferBetweenPockets, updatePocketBalance } = usePockets()
  const toast = useToast()

  const [showForm, setShowForm]     = useState(false)
  const [form, setForm]             = useState({ name:'', price:'', target_date:'', priority:1 })
  const [submitting, setSubmitting] = useState(false)
  const [fundingItem, setFundingItem] = useState(null)
  const [fundAmount, setFundAmount]   = useState('')
  const [editItem, setEditItem]       = useState(null)

  const activeItems    = wishlist.filter((w) => !w.is_completed).sort((a,b) => a.priority - b.priority)
  const completedItems = wishlist.filter((w) =>  w.is_completed)
  const wishlistPocket = getPocketByName('wishlist')
  const wishlistBalance = wishlistPocket?.balance || 0

  // Estimasi nabung per minggu: pakai rata-rata dari pocket wishlist dibagi jumlah item
  const weeklyPerItem = activeItems.length > 0 && wishlistBalance > 0
    ? Math.round(wishlistBalance / activeItems.length)
    : 0

  // ── Add ────────────────────────────────────────────────────
  async function handleAddItem(e) {
    e.preventDefault()
    if (!form.name || !form.price) return
    setSubmitting(true)
    const { error } = await addWishlistItem({
      name: form.name, price: parseInt(form.price),
      target_date: form.target_date || null,
      priority: parseInt(form.priority) || (activeItems.length + 1),
    })
    setSubmitting(false)
    if (error) { toast('Gagal tambah 😢', 'error'); return }
    toast(`${form.name} masuk wishlist! ✨`, 'success')
    setForm({ name:'', price:'', target_date:'', priority: activeItems.length + 2 })
    setShowForm(false)
  }

  // ── Edit ───────────────────────────────────────────────────
  async function handleEditSave(e) {
    e.preventDefault()
    if (!editItem) return
    setSubmitting(true)
    const { error } = await updateWishlistItem(editItem.id, {
      name: editItem.name, price: parseInt(editItem.price),
      target_date: editItem.target_date || null,
      priority: parseInt(editItem.priority) || 1,
    })
    setSubmitting(false)
    if (error) { toast('Gagal edit 😢', 'error'); return }
    toast('Wishlist diupdate ✅', 'success')
    setEditItem(null)
  }

  // ── Fund (transfer dari pocket wishlist ke item) ──────────
  async function handleFund(item) {
    const amount = parseInt(fundAmount)
    if (!amount || amount <= 0) return
    const pocket = getPocketByName('wishlist')
    if (!pocket) { toast('Pocket wishlist tidak ada', 'error'); return }
    if (pocket.balance < amount) { toast('Saldo tabungan wishlist tidak cukup 🥲', 'error'); return }

    setSubmitting(true)
    const newSaved = Math.min(item.saved_amount + amount, item.price)

    // Update wishlist item
    const { error: e1 } = await updateWishlistItem(item.id, { saved_amount: newSaved })
    if (e1) { toast('Gagal update wishlist 😢', 'error'); setSubmitting(false); return }

    // Kurangi saldo pocket wishlist
    await updatePocketBalance(pocket.id, pocket.balance - amount)

    if (newSaved >= item.price) {
      await updateWishlistItem(item.id, { is_completed: true, saved_amount: item.price })
      toast(`🎉 ${item.name} terkumpul! Selamat!`, 'success')
    } else {
      toast(`+${formatRupiah(amount)} untuk ${item.name} 🐷`, 'success')
    }
    setSubmitting(false)
    setFundingItem(null); setFundAmount('')
  }

  // ── Delete ─────────────────────────────────────────────────
  async function handleDelete(id, name) {
    if (!window.confirm(`Hapus "${name}" dari wishlist?`)) return
    const { error } = await deleteWishlistItem(id)
    if (error) toast('Gagal hapus 😢', 'error')
    else toast(`${name} dihapus`, 'info')
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Wishlist ✨</h1>
      </header>

      <main className="page__content">

        {/* Saldo pocket wishlist */}
        <div className="wishlist-header-card">
          <div className="wishlist-header-card__left">
            <p className="wishlist-header-card__label">Tabungan Wishlist</p>
            <p className="wishlist-header-card__amount">{formatRupiah(wishlistBalance)}</p>
            <p className="wishlist-header-card__sub">{activeItems.length} item aktif</p>
          </div>
          <div className="wishlist-header-card__right">
            <p className="wishlist-header-card__label">Total kurang</p>
            <p className="wishlist-header-card__kurang">
              {formatRupiah(activeItems.reduce((s,w) => s + Math.max(0, w.price - w.saved_amount), 0))}
            </p>
          </div>
        </div>

        {/* Tombol tambah */}
        <button className="btn btn--primary btn--full" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Batal' : '+ Tambah Wishlist'}
        </button>

        {/* Form tambah */}
        {showForm && (
          <form className="card form-card" onSubmit={handleAddItem}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama barang</label>
                <input type="text" className="form-input" placeholder="Headphone baru 🎧" required autoFocus
                  value={form.name} onChange={(e) => setForm((f)=>({...f, name:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga (Rp)</label>
                <input type="number" className="form-input" placeholder="0" min="1" required inputMode="numeric"
                  value={form.price} onChange={(e) => setForm((f)=>({...f, price:e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target tanggal (opsional)</label>
                <input type="date" className="form-input"
                  value={form.target_date} onChange={(e) => setForm((f)=>({...f, target_date:e.target.value}))} />
              </div>
              <div className="form-group">
                <label className="form-label">Prioritas (1 = utama)</label>
                <input type="number" className="form-input" min="1" max="99"
                  value={form.priority} onChange={(e) => setForm((f)=>({...f, priority:e.target.value}))} />
              </div>
            </div>
            <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
              {submitting ? 'Menambahkan...' : '✨ Tambah ke Wishlist'}
            </button>
          </form>
        )}

        {/* Modal Edit */}
        {editItem && (
          <div className="modal-overlay" onClick={() => setEditItem(null)}>
            <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
              <h3 className="modal-card__title">Edit Wishlist</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nama barang</label>
                  <input type="text" className="form-input" required
                    value={editItem.name} onChange={(e) => setEditItem((i)=>({...i, name:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga (Rp)</label>
                  <input type="number" className="form-input" min="1" required inputMode="numeric"
                    value={editItem.price} onChange={(e) => setEditItem((i)=>({...i, price:e.target.value}))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target tanggal</label>
                  <input type="date" className="form-input"
                    value={editItem.target_date || ''} onChange={(e) => setEditItem((i)=>({...i, target_date:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prioritas</label>
                  <input type="number" className="form-input" min="1"
                    value={editItem.priority} onChange={(e) => setEditItem((i)=>({...i, priority:e.target.value}))} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button type="button" className="btn btn--ghost btn--full" onClick={() => setEditItem(null)}>Batal</button>
                <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Wishlist aktif */}
        {activeItems.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state__emoji">💭</span>
            <p>Wishlist masih kosong~</p>
            <p className="text-muted">Yuk tulis impianmu!</p>
          </div>
        ) : (
          <section className="section">
            <h2 className="section__title">Lagi nabung untuk...</h2>
            <div className="wishlist-list">
              {activeItems.map((item) => {
                const pct     = Math.min((item.saved_amount / item.price) * 100, 100)
                const kurang  = Math.max(0, item.price - item.saved_amount)
                const weeks   = weeklyPerItem > 0 && kurang > 0 ? Math.ceil(kurang / weeklyPerItem) : null
                const isFunding = fundingItem === item.id

                // Estimasi dari target_date
                let daysLeft = null
                if (item.target_date) {
                  const diff = Math.ceil((new Date(item.target_date) - new Date()) / (1000*60*60*24))
                  daysLeft = Math.max(0, diff)
                }
                const weeklyNeeded = daysLeft !== null && daysLeft > 0 && kurang > 0
                  ? Math.ceil(kurang / (daysLeft / 7))
                  : null

                return (
                  <div key={item.id} className="wishlist-item-card">
                    <div className="wishlist-item-card__header">
                      <div style={{ flex:1, minWidth:0 }}>
                        <p className="wishlist-item-card__name">
                          <span className="wishlist-item-card__priority">#{item.priority}</span>
                          {item.name}
                        </p>
                        <p className="wishlist-item-card__price">{formatRupiah(item.price)}</p>
                      </div>
                      <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
                        <button className="btn btn--ghost btn--xs"
                          onClick={() => setEditItem({ id:item.id, name:item.name, price:String(item.price), target_date:item.target_date||'', priority:String(item.priority) })}
                          aria-label="Edit">✏️</button>
                        <button className="btn btn--ghost btn--xs"
                          onClick={() => handleDelete(item.id, item.name)} aria-label="Hapus">🗑</button>
                      </div>
                    </div>

                    {/* Progress */}
                    <div className="progress-bar">
                      <div className="progress-bar__fill progress-bar__fill--wishlist" style={{ width:`${pct}%` }} />
                    </div>
                    <div className="wishlist-item-card__progress-info">
                      <span>
                        <span style={{ color:'var(--c-mint)', fontWeight:700 }}>{formatRupiah(item.saved_amount)}</span>
                        {' terkumpul'}
                      </span>
                      <span>{Math.round(pct)}%</span>
                    </div>

                    {/* Info kekurangan & estimasi */}
                    <div className="wishlist-calc">
                      {kurang > 0 ? (
                        <div className="wishlist-calc__row">
                          <span>📌 Kurang</span>
                          <strong className="text-over">{formatRupiah(kurang)}</strong>
                        </div>
                      ) : (
                        <div className="wishlist-calc__row">
                          <span>✅ Dana cukup!</span>
                        </div>
                      )}
                      {item.target_date && (
                        <div className="wishlist-calc__row">
                          <span>🎯 Target</span>
                          <span>{new Date(item.target_date+'T12:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}</span>
                        </div>
                      )}
                      {weeklyNeeded && kurang > 0 && (
                        <div className="wishlist-calc__row">
                          <span>📅 Perlu nabung/minggu</span>
                          <strong>{formatRupiah(weeklyNeeded)}</strong>
                        </div>
                      )}
                      {weeks && !weeklyNeeded && kurang > 0 && (
                        <div className="wishlist-calc__row">
                          <span>⏱ Estimasi selesai</span>
                          <span>~{weeks} minggu lagi</span>
                        </div>
                      )}
                    </div>

                    {/* Tombol tambah tabungan */}
                    {isFunding ? (
                      <div style={{ display:'flex', gap:'6px', marginTop:'8px' }}>
                        <input type="number" className="form-input" placeholder="Rp" inputMode="numeric"
                          value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} autoFocus
                          style={{ flex:1 }} />
                        <button className="btn btn--primary btn--xs" disabled={submitting}
                          onClick={() => handleFund(item)}>✓</button>
                        <button className="btn btn--ghost btn--xs"
                          onClick={() => { setFundingItem(null); setFundAmount('') }}>✕</button>
                      </div>
                    ) : (
                      <button className="btn btn--ghost btn--sm btn--full" style={{ marginTop:'8px' }}
                        onClick={() => { setFundingItem(item.id); setFundAmount('') }}>
                        🐷 Tambah tabungan untuk ini
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Selesai */}
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
                    <button className="btn btn--ghost btn--xs" onClick={() => handleDelete(item.id, item.name)}>🗑</button>
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
