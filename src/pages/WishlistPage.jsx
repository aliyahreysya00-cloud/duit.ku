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
  const [form, setForm]         = useState({ name: '', price: '', target_date: '', priority: '' })
  const [busy, setBusy]         = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [fundId, setFundId]     = useState(null)
  const [fundAmt, setFundAmt]   = useState('')

  const activeItems    = wishlist.filter((w) => !w.is_completed).sort((a, b) => a.priority - b.priority)
  const completedItems = wishlist.filter((w) =>  w.is_completed)
  const wp             = getPocketByName('wishlist')
  const wBalance       = wp?.balance || 0
  const totalKurang    = activeItems.reduce((s, w) => s + Math.max(0, w.price - w.saved_amount), 0)

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.name || !form.price) return
    setBusy(true)
    const { error } = await addWishlistItem({
      name:        form.name,
      price:       parseInt(form.price),
      target_date: form.target_date || null,
      priority:    parseInt(form.priority) || activeItems.length + 1,
    })
    setBusy(false)
    if (error) { toast('Gagal tambah', 'error'); return }
    toast(`${form.name} ditambahkan ✓`, 'success')
    setForm({ name: '', price: '', target_date: '', priority: '' })
    setShowForm(false)
  }

  async function handleEditSave(e) {
    e.preventDefault()
    if (!editItem) return
    setBusy(true)
    const { error } = await updateWishlistItem(editItem.id, {
      name:        editItem.name,
      price:       parseInt(editItem.price),
      target_date: editItem.target_date || null,
      priority:    parseInt(editItem.priority) || 1,
    })
    setBusy(false)
    if (error) { toast('Gagal edit', 'error'); return }
    toast('Diupdate ✓', 'success')
    setEditItem(null)
  }

  async function handleFund(item) {
    const amount = parseInt(fundAmt)
    if (!amount || amount <= 0) return
    if (!wp) { toast('Pocket wishlist tidak ada', 'error'); return }
    if (wBalance < amount) { toast('Saldo tidak cukup', 'error'); return }
    setBusy(true)
    const newSaved = Math.min(item.saved_amount + amount, item.price)
    const { error } = await updateWishlistItem(item.id, { saved_amount: newSaved })
    if (error) { toast('Gagal update', 'error'); setBusy(false); return }
    await updatePocketBalance(wp.id, wBalance - amount)
    if (newSaved >= item.price) {
      await updateWishlistItem(item.id, { is_completed: true, saved_amount: item.price })
      toast(`🎉 ${item.name} terkumpul!`, 'success')
    } else {
      toast(`+${formatRupiah(amount)} untuk ${item.name}`, 'success')
    }
    setBusy(false)
    setFundId(null); setFundAmt('')
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Hapus "${name}"?`)) return
    const { error } = await deleteWishlistItem(id)
    if (error) toast('Gagal hapus', 'error')
    else toast(`${name} dihapus`, 'info')
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Wishlist ✨</h1>
      </div>

      <div className="page__content">

        {/* Header card */}
        <div className="wl-header">
          <div>
            <p className="wl-header__lbl">Tabungan Wishlist</p>
            <p className="wl-header__val">{formatRupiah(wBalance)}</p>
            <p className="wl-header__sub">{activeItems.length} item aktif</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p className="wl-header__lbl">Total kurang</p>
            <p className="wl-header__kurang">{formatRupiah(totalKurang)}</p>
          </div>
        </div>

        {/* Tombol tambah */}
        <button className="btn btn--primary btn--full" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Batal' : '+ Tambah Wishlist'}
        </button>

        {/* Form tambah */}
        {showForm && (
          <form className="card" onSubmit={handleAdd}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nama barang</label>
                <input type="text" className="form-input" placeholder="Headphone baru" required autoFocus
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Harga (Rp)</label>
                <input type="number" className="form-input" placeholder="0" min="1" required inputMode="numeric"
                  value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Target tanggal</label>
                <input type="date" className="form-input"
                  value={form.target_date} onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Prioritas (1 = utama)</label>
                <input type="number" className="form-input" placeholder={activeItems.length + 1} min="1" max="99"
                  value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
              </div>
            </div>
            <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
              {busy ? 'Menambahkan...' : 'Tambah ke Wishlist'}
            </button>
          </form>
        )}

        {/* Modal edit */}
        {editItem && (
          <div className="modal-overlay" onClick={() => setEditItem(null)}>
            <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
              <div className="modal-handle" />
              <p className="modal-title">Edit Wishlist</p>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nama barang</label>
                  <input type="text" className="form-input" required
                    value={editItem.name} onChange={(e) => setEditItem((i) => ({ ...i, name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Harga (Rp)</label>
                  <input type="number" className="form-input" min="1" required inputMode="numeric"
                    value={editItem.price} onChange={(e) => setEditItem((i) => ({ ...i, price: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Target tanggal</label>
                  <input type="date" className="form-input"
                    value={editItem.target_date || ''} onChange={(e) => setEditItem((i) => ({ ...i, target_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Prioritas</label>
                  <input type="number" className="form-input" min="1"
                    value={editItem.priority} onChange={(e) => setEditItem((i) => ({ ...i, priority: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--full" onClick={() => setEditItem(null)}>Batal</button>
                <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
                  {busy ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Wishlist aktif */}
        {activeItems.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">💭</div>
            <p>Wishlist masih kosong</p>
            <p className="t3">Tulis impianmu di sini!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeItems.map((item) => {
              const pct    = Math.min((item.saved_amount / item.price) * 100, 100)
              const kurang = Math.max(0, item.price - item.saved_amount)

              // Estimasi dari target tanggal
              let weeklyNeeded = null
              if (item.target_date && kurang > 0) {
                const daysLeft = Math.max(0, Math.ceil((new Date(item.target_date) - new Date()) / 86400000))
                if (daysLeft > 0) weeklyNeeded = Math.ceil(kurang / (daysLeft / 7))
              }

              return (
                <div key={item.id} className="wl-card">
                  {/* Header */}
                  <div className="wl-card__top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p className="wl-card__name">
                        <span className="wl-card__pri">#{item.priority}</span>
                        {item.name}
                      </p>
                      <p className="wl-card__price">{formatRupiah(item.price)}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button className="btn btn--ghost btn--xs"
                        onClick={() => setEditItem({ id: item.id, name: item.name, price: String(item.price), target_date: item.target_date || '', priority: String(item.priority) })}>
                        ✏️
                      </button>
                      <button className="btn btn--ghost btn--xs" onClick={() => handleDelete(item.id, item.name)}>🗑️</button>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="wl-prog-info">
                    <span><span className="grn fw7">{formatRupiah(item.saved_amount)}</span> terkumpul</span>
                    <span className="fw7">{Math.round(pct)}%</span>
                  </div>

                  {/* Kalkulasi */}
                  <div className="wl-calc">
                    {kurang > 0 ? (
                      <div className="wl-calc-row">
                        <span>Masih kurang</span>
                        <span className="red fw7">{formatRupiah(kurang)}</span>
                      </div>
                    ) : (
                      <div className="wl-calc-row">
                        <span className="grn fw7">✓ Dana sudah cukup!</span>
                      </div>
                    )}
                    {item.target_date && (
                      <div className="wl-calc-row">
                        <span>Target</span>
                        <span>{new Date(item.target_date + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                    {weeklyNeeded && kurang > 0 && (
                      <div className="wl-calc-row">
                        <span>Nabung/minggu agar tepat waktu</span>
                        <span className="vio fw7">{formatRupiah(weeklyNeeded)}</span>
                      </div>
                    )}
                  </div>

                  {/* Fund */}
                  {fundId === item.id ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <input type="number" className="form-input" placeholder="Jumlah (Rp)"
                        value={fundAmt} onChange={(e) => setFundAmt(e.target.value)}
                        inputMode="numeric" autoFocus style={{ flex: 1 }} />
                      <button className="btn btn--primary btn--xs" disabled={busy} onClick={() => handleFund(item)}>✓</button>
                      <button className="btn btn--ghost btn--xs" onClick={() => { setFundId(null); setFundAmt('') }}>✕</button>
                    </div>
                  ) : (
                    kurang > 0 && (
                      <button className="btn btn--ghost btn--sm btn--full" style={{ marginTop: 10 }}
                        onClick={() => { setFundId(item.id); setFundAmt('') }}>
                        + Tambah tabungan untuk ini
                      </button>
                    )
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Selesai */}
        {completedItems.length > 0 && (
          <div>
            <p className="s-label" style={{ marginTop: 4 }}>Sudah tercapai 🎉</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {completedItems.map((item) => (
                <div key={item.id} className="wl-card wl-card--done"
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>✅ {item.name}</p>
                    <p className="t3" style={{ fontSize: '0.75rem', marginTop: 2 }}>{formatRupiah(item.price)}</p>
                  </div>
                  <button className="btn btn--ghost btn--xs" onClick={() => handleDelete(item.id, item.name)}>🗑️</button>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
