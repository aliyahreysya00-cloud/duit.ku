import { useState, useMemo } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import { usePockets } from '../hooks/usePockets'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { formatRupiah, isWfhDay } from '../lib/utils'

const EXPENSE_CATS = [
  { value: 'transport',   label: '🚌 Transport'   },
  { value: 'makan_siang', label: '🍱 Makan Siang' },
  { value: 'makan_malam', label: '🍜 Makan Malam' },
  { value: 'jajan',       label: '🧋 Jajan'        },
  { value: 'lainnya',     label: '📦 Lainnya'      },
]
const INCOME_CATS = [
  { value: 'uang_saku',   label: '💰 Uang Saku'  },
  { value: 'gaji_magang', label: '💼 Gaji Magang' },
  { value: 'lainnya',     label: '📦 Lainnya'     },
]

function getCatIcon(cat) {
  return { transport:'🚌', makan_siang:'🍱', makan_malam:'🍜', jajan:'🧋', lainnya:'📦', uang_saku:'💰', gaji_magang:'💼' }[cat] ?? '📦'
}
function getCatLabel(cat) {
  return { transport:'Transport', makan_siang:'Makan Siang', makan_malam:'Makan Malam', jajan:'Jajan', lainnya:'Lainnya', uang_saku:'Uang Saku', gaji_magang:'Gaji Magang' }[cat] ?? cat
}

export default function TransactionsPage() {
  const { transactions, addTransaction, deleteTransaction } = useTransactions()
  const { getPocketByName, updatePocketBalance } = usePockets()
  const { profile } = useProfile()
  const toast = useToast()

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const isWFH    = profile ? isWfhDay(today, profile.wfh_days) : false

  const [tab, setTab] = useState('expense')
  const [expForm, setExpForm] = useState({ amount: '', category: 'makan_siang', note: '', date: todayStr })
  const [incForm, setIncForm] = useState({ amount: '', category: 'uang_saku',   note: '', date: todayStr })
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('semua')
  const [editTx, setEditTx] = useState(null) // { id, amount, category, note, date, type }
  const [editSubmitting, setEditSubmitting] = useState(false)

  // Apakah transport hari ini sudah dicatat
  const transportToday = useMemo(() =>
    transactions.some((t) => t.type === 'expense' && t.category === 'transport' && t.date === todayStr),
    [transactions, todayStr])

  // ── Submit Pengeluaran ────────────────────────────────────
  async function handleExpenseSubmit(e) {
    e.preventDefault()
    const amount = parseInt(expForm.amount)
    if (!amount || amount <= 0) return
    setSubmitting(true)

    const jajanPocket = getPocketByName('jajan')
    const { error } = await addTransaction({
      type: 'expense', amount, category: expForm.category, note: expForm.note, date: expForm.date,
    })
    if (error) { toast('Gagal menyimpan 😢', 'error'); setSubmitting(false); return }

    // Kurangi saldo jajan otomatis
    if (jajanPocket) {
      await updatePocketBalance(jajanPocket.id, jajanPocket.balance - amount)
    }

    setSubmitting(false)
    toast('Pengeluaran dicatat & saldo diupdate 📝', 'success')
    setExpForm({ amount: '', category: 'makan_siang', note: '', date: todayStr })
  }

  // ── Submit Pemasukan ──────────────────────────────────────
  async function handleIncomeSubmit(e) {
    e.preventDefault()
    const amount = parseInt(incForm.amount)
    if (!amount || amount <= 0) return
    setSubmitting(true)

    const jajanPocket = getPocketByName('jajan')
    const { error } = await addTransaction({
      type: 'income', amount, category: incForm.category, note: incForm.note, date: incForm.date,
    })
    if (error) { toast('Gagal menyimpan 😢', 'error'); setSubmitting(false); return }

    // Tambah saldo jajan otomatis
    if (jajanPocket) {
      await updatePocketBalance(jajanPocket.id, jajanPocket.balance + amount)
    }

    setSubmitting(false)
    toast(`+${formatRupiah(amount)} masuk ke Uang Jajan 🎉`, 'success')
    setIncForm({ amount: '', category: 'uang_saku', note: '', date: todayStr })
  }

  // ── Edit Transaksi ────────────────────────────────────────
  async function handleEditSubmit(e) {
    e.preventDefault()
    if (!editTx) return
    const newAmount = parseInt(editTx.amount)
    if (!newAmount || newAmount <= 0) return

    const original = transactions.find((t) => t.id === editTx.id)
    if (!original) return
    setEditSubmitting(true)

    const jajanPocket = getPocketByName('jajan')
    const diff = newAmount - original.amount // positif = lebih besar dari sebelumnya

    // Update transaksi di Supabase
    const { error } = await import('../lib/supabase').then(({ supabase }) =>
      supabase.from('transactions')
        .update({ amount: newAmount, category: editTx.category, note: editTx.note, date: editTx.date })
        .eq('id', editTx.id)
    )
    if (error) { toast('Gagal edit 😢', 'error'); setEditSubmitting(false); return }

    // Sesuaikan saldo pocket
    if (jajanPocket && diff !== 0) {
      const delta = original.type === 'expense' ? -diff : diff
      await updatePocketBalance(jajanPocket.id, jajanPocket.balance + delta)
    }

    // Refresh transactions
    const { useTransactions: _ } = await import('../hooks/useTransactions')
    setEditSubmitting(false)
    setEditTx(null)
    toast('Transaksi diupdate ✅', 'success')
    // Force re-fetch dengan reload ringan
    window.dispatchEvent(new Event('duitku:refresh'))
  }

  // ── Hapus Transaksi ───────────────────────────────────────
  async function handleDelete(tx) {
    if (!window.confirm(`Hapus transaksi ${getCatLabel(tx.category)} ${formatRupiah(tx.amount)}?`)) return
    const jajanPocket = getPocketByName('jajan')
    const { error } = await deleteTransaction(tx.id)
    if (error) { toast('Gagal hapus 😢', 'error'); return }

    // Rollback saldo
    if (jajanPocket) {
      const delta = tx.type === 'expense' ? tx.amount : -tx.amount
      await updatePocketBalance(jajanPocket.id, jajanPocket.balance + delta)
    }
    toast('Transaksi dihapus', 'info')
  }

  // ── Filter ────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]
    return transactions.filter((t) => {
      if (filter === 'hari_ini')   return t.date === todayStr
      if (filter === 'minggu_ini') return t.date >= weekStartStr
      return true
    })
  }, [transactions, filter, todayStr])

  const todayIncome  = useMemo(() => transactions.filter((t) => t.type === 'income'  && t.date === todayStr).reduce((s,t)=>s+t.amount,0), [transactions, todayStr])
  const todayExpense = useMemo(() => transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s,t)=>s+t.amount,0), [transactions, todayStr])

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Catat 💸</h1>
      </header>

      <main className="page__content">
        {/* Ringkasan hari ini */}
        <div className="summary-row">
          <div className="summary-pill summary-pill--income">
            <span className="summary-pill__label">Masuk hari ini</span>
            <span className="summary-pill__val">+{formatRupiah(todayIncome)}</span>
          </div>
          <div className="summary-pill summary-pill--expense">
            <span className="summary-pill__label">Keluar hari ini</span>
            <span className="summary-pill__val">-{formatRupiah(todayExpense)}</span>
          </div>
        </div>

        {/* Tombol transport cepat */}
        <button
          className={`transport-btn ${isWFH || transportToday ? 'transport-btn--off' : ''}`}
          onClick={() => {
            if (isWFH || transportToday) return
            setExpForm((f) => ({ ...f, amount: String(profile?.transport_amount || 14000), category: 'transport', date: todayStr }))
            setTab('expense')
          }}
          disabled={isWFH || transportToday}
        >
          🚌 Transport hari ini — {formatRupiah(profile?.transport_amount || 14000)}
          {isWFH && <span className="transport-btn__note">WFH</span>}
          {transportToday && !isWFH && <span className="transport-btn__note">✅ Dicatat</span>}
        </button>

        {/* Tab */}
        <div className="tab-bar">
          {[{ key:'expense', label:'💸 Pengeluaran' }, { key:'income', label:'💰 Pemasukan' }].map(({ key, label }) => (
            <button key={key} className={`tab-bar__tab ${tab === key ? 'tab-bar__tab--active' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Form Pengeluaran */}
        {tab === 'expense' && (
          <form className="card form-card" onSubmit={handleExpenseSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nominal (Rp)</label>
                <input type="number" className="form-input form-input--amount"
                  placeholder="0" min="1" inputMode="numeric" required
                  value={expForm.amount} onChange={(e) => setExpForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input type="date" className="form-input" required
                  value={expForm.date} onChange={(e) => setExpForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={expForm.category}
                  onChange={(e) => setExpForm((f) => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input type="text" className="form-input" placeholder="opsional"
                  value={expForm.note} onChange={(e) => setExpForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <p className="form-hint">💡 Otomatis mengurangi saldo Uang Jajan</p>
            <button type="submit" className="btn btn--primary btn--full" disabled={submitting}>
              {submitting ? 'Menyimpan...' : '📝 Catat Pengeluaran'}
            </button>
          </form>
        )}

        {/* Form Pemasukan */}
        {tab === 'income' && (
          <form className="card form-card" onSubmit={handleIncomeSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nominal (Rp)</label>
                <input type="number" className="form-input form-input--amount"
                  placeholder="0" min="1" inputMode="numeric" required
                  value={incForm.amount} onChange={(e) => setIncForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input type="date" className="form-input" required
                  value={incForm.date} onChange={(e) => setIncForm((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={incForm.category}
                  onChange={(e) => setIncForm((f) => ({ ...f, category: e.target.value }))}>
                  {INCOME_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input type="text" className="form-input" placeholder="opsional"
                  value={incForm.note} onChange={(e) => setIncForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <p className="form-hint">💡 Otomatis menambah saldo Uang Jajan</p>
            <button type="submit" className="btn btn--success btn--full" disabled={submitting}>
              {submitting ? 'Menyimpan...' : '💰 Catat Pemasukan'}
            </button>
          </form>
        )}

        {/* Modal Edit */}
        {editTx && (
          <div className="modal-overlay" onClick={() => setEditTx(null)}>
            <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSubmit}>
              <h3 className="modal-card__title">Edit Transaksi</h3>
              <div className="form-group">
                <label className="form-label">Nominal (Rp)</label>
                <input type="number" className="form-input form-input--amount"
                  min="1" inputMode="numeric" required
                  value={editTx.amount} onChange={(e) => setEditTx((t) => ({ ...t, amount: e.target.value }))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={editTx.category}
                    onChange={(e) => setEditTx((t) => ({ ...t, category: e.target.value }))}>
                    {(editTx.type === 'income' ? INCOME_CATS : EXPENSE_CATS).map((c) =>
                      <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tanggal</label>
                  <input type="date" className="form-input" required
                    value={editTx.date} onChange={(e) => setEditTx((t) => ({ ...t, date: e.target.value }))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Catatan</label>
                <input type="text" className="form-input" value={editTx.note || ''}
                  onChange={(e) => setEditTx((t) => ({ ...t, note: e.target.value }))} />
              </div>
              <div style={{ display:'flex', gap:'8px', marginTop:'4px' }}>
                <button type="button" className="btn btn--ghost btn--full" onClick={() => setEditTx(null)}>Batal</button>
                <button type="submit" className="btn btn--primary btn--full" disabled={editSubmitting}>
                  {editSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Riwayat */}
        <section className="section">
          <div className="section__header">
            <h2 className="section__title">Riwayat</h2>
            <div className="filter-chips">
              {[{ key:'semua',label:'Semua' },{ key:'hari_ini',label:'Hari ini' },{ key:'minggu_ini',label:'Minggu ini' }].map((f) => (
                <button key={f.key} className={`chip ${filter===f.key?'chip--active':''}`} onClick={() => setFilter(f.key)}>{f.label}</button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="empty-state">
              <span className="empty-state__emoji">🥚</span>
              <p>Belum ada transaksi~</p>
            </div>
          ) : (
            <ul className="tx-list">
              {filteredTx.map((tx) => (
                <li key={tx.id} className={`tx-item tx-item--${tx.type}`}>
                  <span className="tx-item__icon">{tx.type === 'income' ? '💰' : getCatIcon(tx.category)}</span>
                  <div className="tx-item__info">
                    <span className="tx-item__note">{tx.note || getCatLabel(tx.category)}</span>
                    <span className="tx-item__date">
                      {new Date(tx.date + 'T12:00:00').toLocaleDateString('id-ID', { day:'numeric', month:'short' })}
                      {' · '}<span className="tx-item__cat">{getCatLabel(tx.category)}</span>
                    </span>
                  </div>
                  <span className={`tx-item__amount ${tx.type==='income'?'tx-item__amount--income':''}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                  </span>
                  <div className="tx-item__actions">
                    <button className="tx-item__action-btn tx-item__action-btn--edit"
                      onClick={() => setEditTx({ id:tx.id, amount:String(tx.amount), category:tx.category, note:tx.note||'', date:tx.date, type:tx.type })}
                      aria-label="Edit">✏️</button>
                    <button className="tx-item__action-btn tx-item__action-btn--del"
                      onClick={() => handleDelete(tx)} aria-label="Hapus">🗑</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
