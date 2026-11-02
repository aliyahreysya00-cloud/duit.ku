import { useState, useMemo } from 'react'
import { useTransactions } from '../hooks/useTransactions'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { formatRupiah, isWfhDay } from '../lib/utils'

const CATEGORIES = [
  { value: 'transport',    label: '🚌 Transport'    },
  { value: 'makan_siang',  label: '🍱 Makan Siang'  },
  { value: 'makan_malam',  label: '🍜 Makan Malam'  },
  { value: 'jajan',        label: '🧋 Jajan'         },
  { value: 'lainnya',      label: '📦 Lainnya'       },
]

const INCOME_CATEGORIES = [
  { value: 'uang_saku',   label: '💰 Uang Saku'   },
  { value: 'gaji_magang', label: '💼 Gaji Magang'  },
  { value: 'lainnya',     label: '📦 Lainnya'      },
]

export default function TransactionsPage() {
  const { transactions, addTransaction, deleteTransaction } = useTransactions()
  const { profile } = useProfile()
  const toast = useToast()

  const today = new Date()
  const isWFH = profile ? isWfhDay(today, profile.wfh_days) : false
  const todayStr = today.toISOString().split('T')[0]

  const [tab, setTab] = useState('expense') // 'expense' | 'income'
  const [form, setForm] = useState({
    amount: '',
    category: 'makan_siang',
    note: '',
    date: todayStr,
  })
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    category: 'uang_saku',
    note: '',
    date: todayStr,
  })
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('semua') // 'semua' | 'hari_ini' | 'minggu_ini'

  // Cek apakah transport hari ini sudah dicatat
  const transportToday = useMemo(() =>
    transactions.some(
      (t) => t.type === 'expense' && t.category === 'transport' && t.date === todayStr
    ),
    [transactions, todayStr]
  )

  function handleTransportQuick() {
    if (isWFH) return
    const amount = profile?.transport_amount || 14000
    setForm((f) => ({ ...f, amount: String(amount), category: 'transport', date: todayStr }))
    setTab('expense')
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault()
    if (!form.amount || isNaN(Number(form.amount))) return
    setSubmitting(true)
    const { error } = await addTransaction({
      type: 'expense',
      amount: parseInt(form.amount),
      category: form.category,
      note: form.note,
      date: form.date,
    })
    setSubmitting(false)
    if (error) {
      toast('Aduh, gagal nyimpen 😢 ' + error, 'error')
    } else {
      toast('Pengeluaran tercatat! 📝', 'success')
      setForm({ amount: '', category: 'makan_siang', note: '', date: todayStr })
    }
  }

  async function handleIncomeSubmit(e) {
    e.preventDefault()
    if (!incomeForm.amount || isNaN(Number(incomeForm.amount))) return
    setSubmitting(true)
    const { error } = await addTransaction({
      type: 'income',
      amount: parseInt(incomeForm.amount),
      category: incomeForm.category,
      note: incomeForm.note,
      date: incomeForm.date,
    })
    setSubmitting(false)
    if (error) {
      toast('Aduh, gagal nyimpen 😢 ' + error, 'error')
    } else {
      toast('Uang masuk tercatat! 🎉', 'success')
      setIncomeForm({ amount: '', category: 'uang_saku', note: '', date: todayStr })
    }
  }

  async function handleDelete(id) {
    const { error } = await deleteTransaction(id)
    if (error) toast('Gagal hapus 😢', 'error')
    else toast('Transaksi dihapus', 'info')
  }

  // Filter transaksi
  const filteredTx = useMemo(() => {
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    const weekStartStr = weekStart.toISOString().split('T')[0]

    return transactions.filter((t) => {
      if (filter === 'hari_ini') return t.date === todayStr
      if (filter === 'minggu_ini') return t.date >= weekStartStr
      return true
    })
  }, [transactions, filter, todayStr])

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Catat Transaksi 💸</h1>
      </header>

      <main className="page__content">
        {/* Tombol cepat transport */}
        <div className="quick-actions">
          <button
            className={`btn ${isWFH || transportToday ? 'btn--ghost btn--disabled' : 'btn--accent'}`}
            onClick={handleTransportQuick}
            disabled={isWFH || transportToday}
            title={isWFH ? 'WFH hari ini, ga perlu transport 🏠' : transportToday ? 'Transport hari ini sudah dicatat ✅' : undefined}
          >
            🚌 Transport hari ini
            {isWFH && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>(WFH)</span>}
            {transportToday && !isWFH && <span style={{ marginLeft: '0.4rem', fontSize: '0.75rem' }}>✅</span>}
          </button>
        </div>

        {/* Tab pengeluaran / pemasukan */}
        <div className="tab-bar" role="tablist">
          <button
            role="tab"
            aria-selected={tab === 'expense'}
            className={`tab-bar__tab ${tab === 'expense' ? 'tab-bar__tab--active' : ''}`}
            onClick={() => setTab('expense')}
          >
            💸 Pengeluaran
          </button>
          <button
            role="tab"
            aria-selected={tab === 'income'}
            className={`tab-bar__tab ${tab === 'income' ? 'tab-bar__tab--active' : ''}`}
            onClick={() => setTab('income')}
          >
            💰 Pemasukan
          </button>
        </div>

        {/* Form pengeluaran */}
        {tab === 'expense' && (
          <form className="card" onSubmit={handleExpenseSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-amount">Nominal (Rp)</label>
              <input
                id="exp-amount"
                type="number"
                className="form-input form-input--large"
                placeholder="0"
                min="1"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                required
                inputMode="numeric"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-cat">Kategori</label>
              <select
                id="exp-cat"
                className="form-select"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-note">Catatan (opsional)</label>
              <input
                id="exp-note"
                type="text"
                className="form-input"
                placeholder="makan ayam geprek 🍗"
                value={form.note}
                onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="exp-date">Tanggal</label>
              <input
                id="exp-date"
                type="date"
                className="form-input"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Nyimpen...' : '📝 Catat Pengeluaran'}
            </button>
          </form>
        )}

        {/* Form pemasukan */}
        {tab === 'income' && (
          <form className="card" onSubmit={handleIncomeSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="inc-amount">Nominal (Rp)</label>
              <input
                id="inc-amount"
                type="number"
                className="form-input form-input--large"
                placeholder="0"
                min="1"
                value={incomeForm.amount}
                onChange={(e) => setIncomeForm((f) => ({ ...f, amount: e.target.value }))}
                required
                inputMode="numeric"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inc-cat">Kategori</label>
              <select
                id="inc-cat"
                className="form-select"
                value={incomeForm.category}
                onChange={(e) => setIncomeForm((f) => ({ ...f, category: e.target.value }))}
              >
                {INCOME_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inc-note">Catatan (opsional)</label>
              <input
                id="inc-note"
                type="text"
                className="form-input"
                placeholder="uang saku minggu ini 💵"
                value={incomeForm.note}
                onChange={(e) => setIncomeForm((f) => ({ ...f, note: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="inc-date">Tanggal</label>
              <input
                id="inc-date"
                type="date"
                className="form-input"
                value={incomeForm.date}
                onChange={(e) => setIncomeForm((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </div>
            <button type="submit" className="btn btn--success" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? 'Nyimpen...' : '💰 Catat Pemasukan'}
            </button>
          </form>
        )}

        {/* Riwayat transaksi */}
        <section className="section">
          <div className="section__header">
            <h2 className="section__title">Riwayat</h2>
            <div className="filter-chips" role="group" aria-label="Filter transaksi">
              {[
                { key: 'semua', label: 'Semua' },
                { key: 'hari_ini', label: 'Hari ini' },
                { key: 'minggu_ini', label: 'Minggu ini' },
              ].map((f) => (
                <button
                  key={f.key}
                  className={`chip ${filter === f.key ? 'chip--active' : ''}`}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label}
                </button>
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
                  <span className="tx-item__icon">
                    {tx.type === 'income' ? '💰' : getCategoryIcon(tx.category)}
                  </span>
                  <div className="tx-item__info">
                    <span className="tx-item__note">{tx.note || getCategoryLabel(tx.category)}</span>
                    <span className="tx-item__date">
                      {new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <span className={`tx-item__amount ${tx.type === 'income' ? 'tx-item__amount--income' : ''}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                  </span>
                  <button
                    className="tx-item__delete"
                    onClick={() => handleDelete(tx.id)}
                    aria-label="Hapus transaksi"
                    title="Hapus"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

function getCategoryIcon(cat) {
  const icons = {
    transport: '🚌', makan_siang: '🍱', makan_malam: '🍜',
    jajan: '🧋', lainnya: '📦',
  }
  return icons[cat] || '📦'
}

function getCategoryLabel(cat) {
  const labels = {
    transport: 'Transport', makan_siang: 'Makan Siang', makan_malam: 'Makan Malam',
    jajan: 'Jajan', lainnya: 'Lainnya', uang_saku: 'Uang Saku', gaji_magang: 'Gaji Magang',
  }
  return labels[cat] || cat
}
