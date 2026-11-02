import { useState, useMemo } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import { usePockets } from '../hooks/usePockets'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { formatRupiah, isWfhDay } from '../lib/utils'
import { supabase } from '../lib/supabase'

const EXP_CATS = [
  { value: 'transport',   label: '🚌 Transport'   },
  { value: 'makan_siang', label: '🍱 Makan Siang' },
  { value: 'makan_malam', label: '🍜 Makan Malam' },
  { value: 'jajan',       label: '🧋 Jajan'        },
  { value: 'lainnya',     label: '📦 Lainnya'      },
]
const INC_CATS = [
  { value: 'uang_saku',   label: '💰 Uang Saku'  },
  { value: 'gaji_magang', label: '💼 Gaji Magang' },
  { value: 'lainnya',     label: '📦 Lainnya'     },
]
const ICON  = { transport:'🚌', makan_siang:'🍱', makan_malam:'🍜', jajan:'🧋', lainnya:'📦', uang_saku:'💰', gaji_magang:'💼' }
const LABEL = { transport:'Transport', makan_siang:'Makan Siang', makan_malam:'Makan Malam', jajan:'Jajan', lainnya:'Lainnya', uang_saku:'Uang Saku', gaji_magang:'Gaji Magang' }

export default function TransactionsPage() {
  const { transactions, addTransaction, deleteTransaction, refetch } = useTransactions()
  const { getPocketByName, updatePocketBalance } = usePockets()
  const { profile } = useProfile()
  const toast = useToast()

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const isWFH    = profile ? isWfhDay(today, profile.wfh_days) : false

  const [tab,  setTab]  = useState('expense')
  const [expF, setExpF] = useState({ amount: '', category: 'makan_siang', note: '', date: todayStr })
  const [incF, setIncF] = useState({ amount: '', category: 'uang_saku',   note: '', date: todayStr })
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('semua')
  const [editTx, setEditTx] = useState(null)

  const transportToday = useMemo(() =>
    transactions.some((t) => t.type === 'expense' && t.category === 'transport' && t.date === todayStr),
    [transactions, todayStr])

  async function submitExpense(e) {
    e.preventDefault()
    const amount = parseInt(expF.amount)
    if (!amount || amount <= 0) return
    setBusy(true)
    const { error } = await addTransaction({ type: 'expense', amount, category: expF.category, note: expF.note, date: expF.date })
    if (error) { toast('Gagal menyimpan', 'error'); setBusy(false); return }
    const jp = getPocketByName('jajan')
    if (jp) await updatePocketBalance(jp.id, jp.balance - amount)
    setBusy(false)
    toast('Pengeluaran dicatat ✓', 'success')
    setExpF({ amount: '', category: 'makan_siang', note: '', date: todayStr })
  }

  async function submitIncome(e) {
    e.preventDefault()
    const amount = parseInt(incF.amount)
    if (!amount || amount <= 0) return
    setBusy(true)
    const { error } = await addTransaction({ type: 'income', amount, category: incF.category, note: incF.note, date: incF.date })
    if (error) { toast('Gagal menyimpan', 'error'); setBusy(false); return }
    const jp = getPocketByName('jajan')
    if (jp) await updatePocketBalance(jp.id, jp.balance + amount)
    setBusy(false)
    toast(`+${formatRupiah(amount)} masuk ke Uang Jajan`, 'success')
    setIncF({ amount: '', category: 'uang_saku', note: '', date: todayStr })
  }

  async function submitEdit(e) {
    e.preventDefault()
    if (!editTx) return
    const newAmt = parseInt(editTx.amount)
    if (!newAmt || newAmt <= 0) return
    setBusy(true)
    const original = transactions.find((t) => t.id === editTx.id)
    const { error } = await supabase.from('transactions')
      .update({ amount: newAmt, category: editTx.category, note: editTx.note, date: editTx.date })
      .eq('id', editTx.id)
    if (error) { toast('Gagal edit', 'error'); setBusy(false); return }
    const jp   = getPocketByName('jajan')
    const diff = newAmt - original.amount
    if (jp && diff !== 0) {
      const delta = original.type === 'expense' ? -diff : diff
      await updatePocketBalance(jp.id, jp.balance + delta)
    }
    await refetch()
    setBusy(false)
    setEditTx(null)
    toast('Transaksi diupdate ✓', 'success')
  }

  async function handleDelete(tx) {
    if (!window.confirm(`Hapus ${LABEL[tx.category] || tx.category} ${formatRupiah(tx.amount)}?`)) return
    const jp = getPocketByName('jajan')
    const { error } = await deleteTransaction(tx.id)
    if (error) { toast('Gagal hapus', 'error'); return }
    if (jp) await updatePocketBalance(jp.id, jp.balance + (tx.type === 'expense' ? tx.amount : -tx.amount))
    toast('Dihapus', 'info')
  }

  const filteredTx = useMemo(() => {
    const ws = new Date(today)
    ws.setDate(today.getDate() - today.getDay())
    const wsStr = ws.toISOString().split('T')[0]
    return transactions.filter((t) => {
      if (filter === 'hari_ini')   return t.date === todayStr
      if (filter === 'minggu_ini') return t.date >= wsStr
      return true
    })
  }, [transactions, filter, todayStr])

  const todayIn  = useMemo(() => transactions.filter((t) => t.type === 'income'  && t.date === todayStr).reduce((s, t) => s + t.amount, 0), [transactions, todayStr])
  const todayOut = useMemo(() => transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s, t) => s + t.amount, 0), [transactions, todayStr])

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Catat</h1>
      </div>

      <div className="page__content">

        {/* Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="stat-pill">
            <p className="stat-pill__label">Masuk hari ini</p>
            <p className="stat-pill__val stat-pill__val--green">+{formatRupiah(todayIn)}</p>
          </div>
          <div className="stat-pill">
            <p className="stat-pill__label">Keluar hari ini</p>
            <p className="stat-pill__val stat-pill__val--orange">-{formatRupiah(todayOut)}</p>
          </div>
        </div>

        {/* Transport cepat */}
        <button
          className={`transport-btn ${isWFH || transportToday ? 'transport-btn--off' : ''}`}
          disabled={isWFH || transportToday}
          onClick={() => {
            if (isWFH || transportToday) return
            setExpF((f) => ({ ...f, amount: String(profile?.transport_amount || 14000), category: 'transport', date: todayStr }))
            setTab('expense')
          }}
        >
          <span>🚌</span>
          <span>Transport hari ini — {formatRupiah(profile?.transport_amount || 14000)}</span>
          {isWFH           && <span className="transport-btn__note">WFH</span>}
          {transportToday && !isWFH && <span className="transport-btn__note">✓ Dicatat</span>}
        </button>

        {/* Tabs */}
        <div className="tabs">
          {[{ key: 'expense', label: 'Pengeluaran' }, { key: 'income', label: 'Pemasukan' }].map(({ key, label }) => (
            <button key={key} className={`tabs__tab ${tab === key ? 'tabs__tab--active' : ''}`} onClick={() => setTab(key)}>
              {label}
            </button>
          ))}
        </div>

        {/* Form Pengeluaran */}
        {tab === 'expense' && (
          <form className="glass" style={{ padding: 16 }} onSubmit={submitExpense}>
            <div className="form-group">
              <label className="form-label">Nominal</label>
              <input type="number" className="form-input form-input--amount"
                placeholder="0" min="1" inputMode="numeric" required autoFocus
                value={expF.amount} onChange={(e) => setExpF((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={expF.category}
                  onChange={(e) => setExpF((f) => ({ ...f, category: e.target.value }))}>
                  {EXP_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input type="date" className="form-input" required
                  value={expF.date} onChange={(e) => setExpF((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <input type="text" className="form-input" placeholder="opsional"
                value={expF.note} onChange={(e) => setExpF((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <p className="form-hint">Otomatis mengurangi saldo Uang Jajan</p>
            <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Catat Pengeluaran'}
            </button>
          </form>
        )}

        {/* Form Pemasukan */}
        {tab === 'income' && (
          <form className="glass" style={{ padding: 16 }} onSubmit={submitIncome}>
            <div className="form-group">
              <label className="form-label">Nominal</label>
              <input type="number" className="form-input form-input--amount"
                placeholder="0" min="1" inputMode="numeric" required autoFocus
                value={incF.amount} onChange={(e) => setIncF((f) => ({ ...f, amount: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Kategori</label>
                <select className="form-select" value={incF.category}
                  onChange={(e) => setIncF((f) => ({ ...f, category: e.target.value }))}>
                  {INC_CATS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tanggal</label>
                <input type="date" className="form-input" required
                  value={incF.date} onChange={(e) => setIncF((f) => ({ ...f, date: e.target.value }))} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Catatan</label>
              <input type="text" className="form-input" placeholder="opsional"
                value={incF.note} onChange={(e) => setIncF((f) => ({ ...f, note: e.target.value }))} />
            </div>
            <p className="form-hint">Otomatis menambah saldo Uang Jajan</p>
            <button type="submit" className="btn btn--success btn--full" disabled={busy}>
              {busy ? 'Menyimpan...' : 'Catat Pemasukan'}
            </button>
          </form>
        )}

        {/* Modal Edit */}
        {editTx && (
          <div className="modal-overlay" onClick={() => setEditTx(null)}>
            <form className="modal-card" onClick={(e) => e.stopPropagation()} onSubmit={submitEdit}>
              <div className="modal-handle" />
              <p className="modal-title">Edit Transaksi</p>
              <div className="form-group">
                <label className="form-label">Nominal</label>
                <input type="number" className="form-input form-input--amount" min="1" required inputMode="numeric"
                  value={editTx.amount} onChange={(e) => setEditTx((t) => ({ ...t, amount: e.target.value }))} autoFocus />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Kategori</label>
                  <select className="form-select" value={editTx.category}
                    onChange={(e) => setEditTx((t) => ({ ...t, category: e.target.value }))}>
                    {(editTx.type === 'income' ? INC_CATS : EXP_CATS).map((c) =>
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
                <input type="text" className="form-input"
                  value={editTx.note || ''} onChange={(e) => setEditTx((t) => ({ ...t, note: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--ghost btn--full" onClick={() => setEditTx(null)}>Batal</button>
                <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
                  {busy ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Riwayat */}
        <div>
          <div className="s-header">
            <p className="s-title">Riwayat</p>
            <div className="filter-chips">
              {[{ key: 'semua', label: 'Semua' }, { key: 'hari_ini', label: 'Hari ini' }, { key: 'minggu_ini', label: 'Minggu ini' }].map((f) => (
                <button key={f.key} className={`chip ${filter === f.key ? 'chip--active' : ''}`} onClick={() => setFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 0' }}>
              <div className="empty-state__icon">🧾</div>
              <p>Belum ada transaksi</p>
            </div>
          ) : (
            <ul className="tx-list">
              {filteredTx.map((tx) => (
                <li key={tx.id} className="tx-item">
                  <div className={`tx-item__dot tx-item__dot--${tx.type}`}>
                    {tx.type === 'income' ? '💰' : ICON[tx.category] || '📦'}
                  </div>
                  <div className="tx-item__info">
                    <p className="tx-item__note">{tx.note || LABEL[tx.category] || tx.category}</p>
                    <p className="tx-item__meta">
                      {new Date(tx.date + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                      {' · '}{LABEL[tx.category] || tx.category}
                    </p>
                  </div>
                  <p className={`tx-item__amount tx-item__amount--${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                  </p>
                  <div className="tx-item__actions">
                    <button className="tx-item__btn"
                      onClick={() => setEditTx({ id: tx.id, amount: String(tx.amount), category: tx.category, note: tx.note || '', date: tx.date, type: tx.type })}>
                      ✏️
                    </button>
                    <button className="tx-item__btn" onClick={() => handleDelete(tx)}>🗑️</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
