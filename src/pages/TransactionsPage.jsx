import { useState, useMemo } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import { usePockets } from '../hooks/usePockets'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { formatRupiah, isWfhDay, getLocalDateStr } from '../lib/utils'
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
const POCKET_OPTS = [
  { value: 'jajan',    label: '🍜 Uang Jajan'       },
  { value: 'tabungan', label: '🏦 Tabungan'          },
  { value: 'wishlist', label: '✨ Tabungan Wishlist' },
]

const ICON  = { transport:'🚌', makan_siang:'🍱', makan_malam:'🍜', jajan:'🧋', lainnya:'📦', uang_saku:'💰', gaji_magang:'💼' }
const LABEL = { transport:'Transport', makan_siang:'Makan Siang', makan_malam:'Makan Malam', jajan:'Jajan', lainnya:'Lainnya', uang_saku:'Uang Saku', gaji_magang:'Gaji Magang' }
const POCKET_LABEL = { jajan:'Uang Jajan', tabungan:'Tabungan', wishlist:'Tabungan Wishlist' }
const POCKET_ICON  = { jajan:'🍜', tabungan:'🏦', wishlist:'✨' }

export default function TransactionsPage() {
  const { transactions, addTransaction, deleteTransaction, refetch } = useTransactions()
  const { getPocketByName, updatePocketBalance } = usePockets()
  const { profile } = useProfile()
  const toast = useToast()

  const today    = new Date()
  const todayStr = getLocalDateStr(today)
  const isWFH    = profile ? isWfhDay(today, profile.wfh_days) : false

  const [tab,    setTab]    = useState('expense')
  // pocket: dari pos mana uang diambil/masuk
  const [expF,   setExpF]   = useState({ amount: '', category: 'makan_siang', note: '', date: todayStr, pocket: 'jajan' })
  const [incF,   setIncF]   = useState({ amount: '', category: 'uang_saku',   note: '', date: todayStr, pocket: 'jajan' })
  const [busy,   setBusy]   = useState(false)
  const [filter, setFilter] = useState('semua')
  const [editTx, setEditTx] = useState(null)

  const transportToday = useMemo(() =>
    transactions.some((t) => t.type === 'expense' && t.category === 'transport' && t.date === todayStr),
    [transactions, todayStr])

  // ── Ambil pocket yang tepat ───────────────────────────────
  function getPocket(name) {
    return getPocketByName(name)
  }

  // ── Submit Pengeluaran ────────────────────────────────────
  async function submitExpense(e) {
    e.preventDefault()
    const amount = parseInt(expF.amount)
    if (!amount || amount <= 0) return
    setBusy(true)

    // Simpan dengan info pocket di note atau field
    const { error } = await addTransaction({
      type: 'expense', amount,
      category: expF.category,
      note: expF.note,
      date: expF.date,
      pocket_id: getPocket(expF.pocket)?.id || null,
    })
    if (error) { toast('Gagal menyimpan', 'error'); setBusy(false); return }

    // Kurangi saldo pocket yang dipilih
    const p = getPocket(expF.pocket)
    if (p) await updatePocketBalance(p.id, p.balance - amount, {
      source: `Pengeluaran ${LABEL[expF.category] || expF.category} dari ${POCKET_LABEL[expF.pocket]}`,
      note: expF.note,
    })

    setBusy(false)
    toast(`Pengeluaran dicatat dari ${POCKET_LABEL[expF.pocket]} ✓`, 'success')
    setExpF((f) => ({ ...f, amount: '', note: '' }))
  }

  // ── Submit Pemasukan ──────────────────────────────────────
  async function submitIncome(e) {
    e.preventDefault()
    const amount = parseInt(incF.amount)
    if (!amount || amount <= 0) return
    setBusy(true)

    const { error } = await addTransaction({
      type: 'income', amount,
      category: incF.category,
      note: incF.note,
      date: incF.date,
      pocket_id: getPocket(incF.pocket)?.id || null,
    })
    if (error) { toast('Gagal menyimpan', 'error'); setBusy(false); return }

    // Tambah saldo pocket yang dipilih
    const p = getPocket(incF.pocket)
    if (p) await updatePocketBalance(p.id, p.balance + amount, {
      source: `Pemasukan ${LABEL[incF.category] || incF.category} ke ${POCKET_LABEL[incF.pocket]}`,
      note: incF.note,
    })

    setBusy(false)
    toast(`+${formatRupiah(amount)} masuk ke ${POCKET_LABEL[incF.pocket]} ✓`, 'success')
    setIncF((f) => ({ ...f, amount: '', note: '' }))
  }

  // ── Edit transaksi ────────────────────────────────────────
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

    // Sesuaikan saldo pocket yang terdampak
    // Gunakan pocket_name yang tersimpan di transaksi, fallback ke jajan
    const pocketName = editTx.pocket_name || 'jajan'
    const p    = getPocket(pocketName)
    const diff = newAmt - original.amount

    if (p && diff !== 0) {
      const delta = original.type === 'expense' ? -diff : diff
      await updatePocketBalance(p.id, p.balance + delta)
    }

    await refetch()
    setBusy(false)
    setEditTx(null)
    toast('Diupdate ✓', 'success')
  }

  // ── Hapus transaksi → saldo otomatis balik ────────────────
  async function handleDelete(tx) {
    if (!window.confirm(`Hapus ${LABEL[tx.category] || tx.category} ${formatRupiah(tx.amount)}?`)) return
    setBusy(true)

    // Tentukan pocket yang terdampak
    // Coba dari pocket_name di transaksi, fallback ke jajan
    const pocketName = tx.pocket_name || 'jajan'
    const p = getPocket(pocketName)

    const { error } = await deleteTransaction(tx.id)
    if (error) { toast('Gagal hapus', 'error'); setBusy(false); return }

    // Rollback saldo: expense → kembalikan ke pocket, income → kurangi dari pocket
    if (p) {
      const delta = tx.type === 'expense' ? tx.amount : -tx.amount
      await updatePocketBalance(p.id, p.balance + delta)
    }

    setBusy(false)
    toast(`Dihapus & saldo ${POCKET_LABEL[pocketName] || 'Uang Jajan'} dikembalikan`, 'info')
  }

  // ── Filter ────────────────────────────────────────────────
  const filteredTx = useMemo(() => {
    const ws = new Date(today)
    ws.setDate(today.getDate() - today.getDay())
    const wsStr = getLocalDateStr(ws)
    return transactions.filter((t) => {
      if (filter === 'hari_ini')   return t.date === todayStr
      if (filter === 'minggu_ini') return t.date >= wsStr
      return true
    })
  }, [transactions, filter, todayStr])

  const todayIn  = useMemo(() => transactions.filter((t) => t.type === 'income'  && t.date === todayStr).reduce((s, t) => s + t.amount, 0), [transactions, todayStr])
  const todayOut = useMemo(() => transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s, t) => s + t.amount, 0), [transactions, todayStr])

  // Saldo semua pocket untuk ditampilkan
  const pocketBalances = {
    jajan:    getPocketByName('jajan')?.balance    || 0,
    tabungan: getPocketByName('tabungan')?.balance || 0,
    wishlist: getPocketByName('wishlist')?.balance || 0,
  }

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Catat</h1>
      </div>

      <div className="page__content">

        {/* Summary */}
        <div className="stat-row">
          <div className="stat-pill">
            <p className="stat-pill__lbl">Masuk hari ini</p>
            <p className="stat-pill__val stat-pill__val--g">+{formatRupiah(todayIn)}</p>
          </div>
          <div className="stat-pill">
            <p className="stat-pill__lbl">Keluar hari ini</p>
            <p className="stat-pill__val stat-pill__val--o">-{formatRupiah(todayOut)}</p>
          </div>
        </div>

        {/* Transport cepat */}
        <button
          className={`transport-btn ${isWFH || transportToday ? 'transport-btn--off' : ''}`}
          disabled={isWFH || transportToday}
          onClick={() => {
            if (isWFH || transportToday) return
            setExpF((f) => ({ ...f, amount: String(profile?.transport_amount || 14000), category: 'transport', date: todayStr, pocket: 'jajan' }))
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
          <form className="card" onSubmit={submitExpense}>
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

            {/* Pilih dari pos mana */}
            <div className="form-group">
              <label className="form-label">Ambil dari pos</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {POCKET_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setExpF((f) => ({ ...f, pocket: opt.value }))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 'var(--r1)',
                      fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'var(--ff)', border: '1px solid',
                      background: expF.pocket === opt.value ? 'rgba(167,139,250,.2)' : 'var(--g)',
                      borderColor: expF.pocket === opt.value ? 'rgba(167,139,250,.5)' : 'var(--g-b)',
                      color: expF.pocket === opt.value ? 'var(--violet)' : 'var(--t2)',
                      transition: 'all .12s',
                    }}
                  >
                    <div>{opt.value === 'jajan' ? '🍜' : opt.value === 'tabungan' ? '🏦' : '✨'}</div>
                    <div style={{ marginTop: 2 }}>
                      {opt.value === 'jajan' ? 'Jajan' : opt.value === 'tabungan' ? 'Tabungan' : 'Wishlist'}
                    </div>
                    <div style={{ fontSize: '0.65rem', opacity: .7, marginTop: 1 }}>
                      {formatRupiah(pocketBalances[opt.value], true)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
              {busy ? 'Menyimpan...' : `Catat dari ${POCKET_LABEL[expF.pocket]}`}
            </button>
          </form>
        )}

        {/* Form Pemasukan */}
        {tab === 'income' && (
          <form className="card" onSubmit={submitIncome}>
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

            {/* Pilih masuk ke pos mana */}
            <div className="form-group">
              <label className="form-label">Masuk ke pos</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {POCKET_OPTS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setIncF((f) => ({ ...f, pocket: opt.value }))}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 'var(--r1)',
                      fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'var(--ff)', border: '1px solid',
                      background: incF.pocket === opt.value ? 'rgba(52,211,153,.18)' : 'var(--g)',
                      borderColor: incF.pocket === opt.value ? 'rgba(52,211,153,.45)' : 'var(--g-b)',
                      color: incF.pocket === opt.value ? 'var(--green)' : 'var(--t2)',
                      transition: 'all .12s',
                    }}
                  >
                    <div>{opt.value === 'jajan' ? '🍜' : opt.value === 'tabungan' ? '🏦' : '✨'}</div>
                    <div style={{ marginTop: 2 }}>
                      {opt.value === 'jajan' ? 'Jajan' : opt.value === 'tabungan' ? 'Tabungan' : 'Wishlist'}
                    </div>
                    <div style={{ fontSize: '0.65rem', opacity: .7, marginTop: 1 }}>
                      {formatRupiah(pocketBalances[opt.value], true)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn--success btn--full" disabled={busy}>
              {busy ? 'Menyimpan...' : `Masuk ke ${POCKET_LABEL[incF.pocket]}`}
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
                <input type="number" className="form-input form-input--amount" min="1" required inputMode="numeric" autoFocus
                  value={editTx.amount} onChange={(e) => setEditTx((t) => ({ ...t, amount: e.target.value }))} />
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
              <div style={{
                padding: '8px 12px',
                background: 'rgba(255,255,255,.04)',
                borderRadius: 'var(--r1)',
                fontSize: '0.78rem',
                color: 'var(--t3)',
                marginBottom: 8,
              }}>
                💡 Saldo <strong style={{ color: 'var(--t1)' }}>
                  {POCKET_ICON[editTx.pocket_name] || '🍜'} {POCKET_LABEL[editTx.pocket_name] || 'Uang Jajan'}
                </strong> akan disesuaikan otomatis
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
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <div className="empty-state__icon">🧾</div>
              <p>Belum ada transaksi</p>
            </div>
          ) : (
            <ul className="tx-list">
              {filteredTx.map((tx) => {
                const pName = tx.pocket_name || 'jajan'
                return (
                  <li key={tx.id} className="tx-item">
                    <div className={`tx-dot tx-dot--${tx.type === 'income' ? 'in' : 'out'}`}>
                      {tx.type === 'income' ? '💰' : (ICON[tx.category] || '📦')}
                    </div>
                    <div className="tx-info">
                      <p className="tx-note">{tx.note || LABEL[tx.category] || tx.category}</p>
                      <p className="tx-meta">
                        {new Date(tx.date + 'T12:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        {' · '}{LABEL[tx.category] || tx.category}
                        {' · '}<span style={{ color: 'var(--t2)' }}>
                          {POCKET_ICON[pName]}{' '}{POCKET_LABEL[pName] || pName}
                        </span>
                      </p>
                    </div>
                    <p className={`tx-amt tx-amt--${tx.type === 'income' ? 'in' : 'out'}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                    </p>
                    <div className="tx-actions">
                      <button className="tx-btn"
                        onClick={() => setEditTx({
                          id: tx.id, amount: String(tx.amount),
                          category: tx.category, note: tx.note || '',
                          date: tx.date, type: tx.type,
                          pocket_name: pName,
                        })}>
                        ✏️
                      </button>
                      <button className="tx-btn" onClick={() => handleDelete(tx)}>🗑️</button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

      </div>
    </div>
  )
}
