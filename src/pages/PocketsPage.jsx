import { useState, useMemo } from 'react'
import { usePockets } from '../hooks/usePockets'
import { useTransactions } from '../hooks/useTransactions'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import Mascot from '../components/Mascot'
import { formatRupiah, isWfhDay, getWeekDates } from '../lib/utils'

export default function PocketsPage() {
  const { pockets, updatePocketBalance, getPocketByName } = usePockets()
  const { transactions } = useTransactions()
  const { profile } = useProfile()
  const toast = useToast()

  const [editingPocket, setEditingPocket] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Hitung pengeluaran minggu ini
  const weekDates = getWeekDates(today)
  const weekStart = weekDates[0].toISOString().split('T')[0]
  const weekEnd = weekDates[6].toISOString().split('T')[0]

  const weekExpenses = useMemo(() =>
    transactions.filter(
      (t) => t.type === 'expense' && t.date >= weekStart && t.date <= weekEnd
    ).reduce((sum, t) => sum + t.amount, 0),
    [transactions, weekStart, weekEnd]
  )

  const weekIncome = useMemo(() =>
    transactions.filter(
      (t) => t.type === 'income' && t.date >= weekStart && t.date <= weekEnd
    ).reduce((sum, t) => sum + t.amount, 0),
    [transactions, weekStart, weekEnd]
  )

  // Estimasi pengeluaran harian
  const dailyBudget = useMemo(() => {
    if (!profile) return 0
    const workDays = 5
    const wfhDays = (profile.wfh_days || [3]).length
    const normalDays = workDays - wfhDays
    const transportPerWeek = normalDays * (profile.transport_amount || 14000)
    const mealPerDay = (profile.lunch_amount || 15000) + (profile.dinner_amount || 15000)
    const mealPerWeek = workDays * mealPerDay
    return Math.round((transportPerWeek + mealPerWeek) / workDays)
  }, [profile])

  // Hitung hari kerja tersisa minggu ini
  const workDaysLeft = useMemo(() => {
    const daysLeft = weekDates.filter((d) => {
      const dStr = d.toISOString().split('T')[0]
      return dStr >= todayStr && d.getDay() !== 0 && d.getDay() !== 6
    }).length
    return daysLeft
  }, [weekDates, todayStr])

  const jajanPocket = getPocketByName('jajan')
  const tabunganPocket = getPocketByName('tabungan')
  const wishlistPocket = getPocketByName('wishlist')

  // Saran nabung
  const savingPercent = profile?.saving_percent || 20
  const jajanBalance = jajanPocket?.balance || 0
  const suggestedSaving = Math.round((jajanBalance * savingPercent) / 100)

  // Mood maskot
  const mood = useMemo(() => {
    if (weekExpenses === 0) return 'neutral'
    const budget5days = dailyBudget * 5
    if (weekExpenses > budget5days * 1.3) return 'sad'
    if (weekExpenses < budget5days * 0.7) return 'happy'
    return 'neutral'
  }, [weekExpenses, dailyBudget])

  async function handleEditSave(pocket) {
    if (!editAmount || isNaN(Number(editAmount))) return
    setSubmitting(true)
    const { error } = await updatePocketBalance(pocket.id, parseInt(editAmount))
    setSubmitting(false)
    if (error) {
      toast('Gagal update saldo 😢', 'error')
    } else {
      toast('Saldo diperbarui! ✅', 'success')
      setEditingPocket(null)
      setEditAmount('')
    }
  }

  async function handleTransfer(fromPocket, toPocket, amount) {
    if (!fromPocket || !toPocket || !amount || amount <= 0) return
    if (fromPocket.balance < amount) {
      toast('Saldo tidak cukup nih 🥲', 'error')
      return
    }
    setSubmitting(true)
    const r1 = await updatePocketBalance(fromPocket.id, fromPocket.balance - amount)
    if (r1.error) { toast('Gagal transfer 😢', 'error'); setSubmitting(false); return }
    const r2 = await updatePocketBalance(toPocket.id, toPocket.balance + amount)
    setSubmitting(false)
    if (r2.error) {
      toast('Gagal update tujuan 😢', 'error')
    } else {
      toast(`Berhasil transfer ${formatRupiah(amount)} ke ${toPocket.name}! 🎉`, 'success')
    }
  }

  const pocketMeta = [
    { key: 'jajan',     icon: '🍜', label: 'Uang Jajan',        color: 'peach',    pocket: jajanPocket },
    { key: 'tabungan',  icon: '🏦', label: 'Tabungan',           color: 'mint',     pocket: tabunganPocket },
    { key: 'wishlist',  icon: '✨', label: 'Tabungan Wishlist',  color: 'lavender', pocket: wishlistPocket },
  ]

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Pos Nabung 🐷</h1>
      </header>

      <main className="page__content">
        {/* Asisten nabung */}
        <section className="card card--assistant">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Mascot mood={mood} size={56} />
            <div>
              <p className="assistant-title">Asisten Nabungmu 🤖</p>
              {mood === 'sad' ? (
                <p className="assistant-msg">Hmm, pengeluaran minggu ini agak banyak nih... Tapi tenang, masih bisa diatur! 💪</p>
              ) : mood === 'happy' ? (
                <p className="assistant-msg">Hemat banget minggu ini! Yuk sisihkan lebih ke tabungan ✨</p>
              ) : (
                <p className="assistant-msg">Kamu masih punya {formatRupiah(jajanBalance)} di uang jajan.</p>
              )}
            </div>
          </div>

          <div className="assistant-stats">
            <div className="assistant-stat">
              <span className="assistant-stat__label">Pengeluaran minggu ini</span>
              <span className="assistant-stat__value">{formatRupiah(weekExpenses)}</span>
            </div>
            <div className="assistant-stat">
              <span className="assistant-stat__label">Sisa hari kerja</span>
              <span className="assistant-stat__value">{workDaysLeft} hari</span>
            </div>
            <div className="assistant-stat">
              <span className="assistant-stat__label">Budget harian</span>
              <span className="assistant-stat__value">{formatRupiah(dailyBudget)}</span>
            </div>
          </div>

          {suggestedSaving > 0 && (
            <div className="saving-suggestion">
              <p>💡 Saranku, sisihkan <strong>{formatRupiah(suggestedSaving)}</strong> ({savingPercent}%) ke tabungan sekarang!</p>
              <button
                className="btn btn--primary btn--sm"
                disabled={submitting || !jajanPocket || !tabunganPocket}
                onClick={() => handleTransfer(jajanPocket, tabunganPocket, suggestedSaving)}
              >
                Sisihkan sekarang
              </button>
            </div>
          )}
        </section>

        {/* Kartu pos uang */}
        <section className="section">
          <h2 className="section__title">Pos uangmu</h2>
          {pocketMeta.map(({ icon, label, color, pocket }) => (
            <div key={label} className={`pocket-card pocket-card--${color}`}>
              <div className="pocket-card__header">
                <span className="pocket-card__icon">{icon}</span>
                <div>
                  <p className="pocket-card__label">{label}</p>
                  {editingPocket === pocket?.id ? (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                      <input
                        type="number"
                        className="form-input"
                        style={{ maxWidth: '140px' }}
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                        placeholder="Saldo baru"
                        inputMode="numeric"
                        autoFocus
                      />
                      <button className="btn btn--primary btn--sm" disabled={submitting}
                        onClick={() => handleEditSave(pocket)}>✓</button>
                      <button className="btn btn--ghost btn--sm"
                        onClick={() => { setEditingPocket(null); setEditAmount('') }}>✕</button>
                    </div>
                  ) : (
                    <p className="pocket-card__amount">{formatRupiah(pocket?.balance || 0)}</p>
                  )}
                </div>
              </div>
              {editingPocket !== pocket?.id && (
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setEditingPocket(pocket?.id)
                    setEditAmount(String(pocket?.balance || 0))
                  }}
                >
                  ✏️ Edit saldo
                </button>
              )}
            </div>
          ))}
        </section>

        {/* Transfer antar pos */}
        <section className="section">
          <h2 className="section__title">Pindah uang antar pos</h2>
          <TransferPanel
            pockets={{ jajanPocket, tabunganPocket, wishlistPocket }}
            onTransfer={handleTransfer}
            submitting={submitting}
          />
        </section>
      </main>
    </div>
  )
}

function TransferPanel({ pockets, onTransfer, submitting }) {
  const [from, setFrom] = useState('jajan')
  const [to, setTo] = useState('tabungan')
  const [amount, setAmount] = useState('')
  const { jajanPocket, tabunganPocket, wishlistPocket } = pockets

  const pocketMap = {
    jajan: jajanPocket,
    tabungan: tabunganPocket,
    wishlist: wishlistPocket,
  }

  const options = [
    { value: 'jajan',    label: '🍜 Uang Jajan' },
    { value: 'tabungan', label: '🏦 Tabungan' },
    { value: 'wishlist', label: '✨ Tabungan Wishlist' },
  ]

  function handleSubmit(e) {
    e.preventDefault()
    if (!amount || from === to) return
    onTransfer(pocketMap[from], pocketMap[to], parseInt(amount))
    setAmount('')
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="form-select" style={{ flex: 1 }} value={from} onChange={(e) => setFrom(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span>→</span>
        <select className="form-select" style={{ flex: 1 }} value={to} onChange={(e) => setTo(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-group" style={{ marginTop: '0.75rem' }}>
        <input
          type="number"
          className="form-input"
          placeholder="Nominal (Rp)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          min="1"
          required
        />
      </div>
      <button
        type="submit"
        className="btn btn--primary"
        disabled={submitting || from === to || !amount}
        style={{ width: '100%' }}
      >
        💸 Pindahkan
      </button>
      {from === to && (
        <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem', textAlign: 'center' }}>
          Pos asal dan tujuan tidak boleh sama ya~
        </p>
      )}
    </form>
  )
}
