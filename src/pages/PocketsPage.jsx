import { useState, useMemo } from 'react'
import { usePockets } from '../hooks/usePockets'
import { useTransactions } from '../hooks/useTransactions'
import { useProfile } from '../hooks/useProfile'
import { useWishlist } from '../hooks/useWishlist'
import { useToast } from '../components/Toast'
import Mascot from '../components/Mascot'
import { formatRupiah, isWfhDay, getWeekDates } from '../lib/utils'

export default function PocketsPage() {
  const { pockets, updatePocketBalance, transferBetweenPockets, getPocketByName } = usePockets()
  const { transactions } = useTransactions()
  const { profile } = useProfile()
  const { wishlist } = useWishlist()
  const toast = useToast()

  const [editingPocket, setEditingPocket] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [transfer, setTransfer] = useState({ from: 'jajan', to: 'tabungan', amount: '' })
  const [showPrevSaving, setShowPrevSaving] = useState(false)
  const [prevSaving, setPrevSaving] = useState({ tabungan: '', wishlist: '' })

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekDates = getWeekDates(today)
  const weekStart = weekDates[0].toISOString().split('T')[0]
  const weekEnd   = weekDates[6].toISOString().split('T')[0]

  const jajanPocket    = getPocketByName('jajan')
  const tabunganPocket = getPocketByName('tabungan')
  const wishlistPocket = getPocketByName('wishlist')

  // ── Kebutuhan rutin minggu ini ─────────────────────────────
  const weeklyNeeds = useMemo(() => {
    if (!profile) return { transport: 0, makan: 0, total: 0, days: [] }
    const { transport_amount=14000, lunch_amount=15000, dinner_amount=20000, wfh_days=[3] } = profile
    const days = weekDates.filter((d) => d.getDay() >= 1 && d.getDay() <= 5)
    const detail = days.map((d) => {
      const dStr  = d.toISOString().split('T')[0]
      const isWfh = isWfhDay(d, wfh_days)
      const trans = isWfh ? 0 : transport_amount
      const makan = lunch_amount + dinner_amount
      return {
        label: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()],
        dateStr: dStr, transport: trans, makan, total: trans + makan,
        isWfh, isPast: dStr < todayStr, isToday: dStr === todayStr,
      }
    })
    return {
      transport: detail.reduce((s,d)=>s+d.transport,0),
      makan:     detail.reduce((s,d)=>s+d.makan,0),
      total:     detail.reduce((s,d)=>s+d.total,0),
      days: detail,
    }
  }, [profile, weekDates, todayStr])

  // ── Aktual pengeluaran minggu ini ──────────────────────────
  const weekActual = useMemo(() => {
    const exp = transactions.filter((t) => t.type==='expense' && t.date>=weekStart && t.date<=weekEnd)
    return {
      total:     exp.reduce((s,t)=>s+t.amount,0),
      transport: exp.filter((t)=>t.category==='transport').reduce((s,t)=>s+t.amount,0),
      makan:     exp.filter((t)=>['makan_siang','makan_malam'].includes(t.category)).reduce((s,t)=>s+t.amount,0),
      jajan:     exp.filter((t)=>!['transport','makan_siang','makan_malam'].includes(t.category)).reduce((s,t)=>s+t.amount,0),
    }
  }, [transactions, weekStart, weekEnd])

  // ── Kalkulasi utama ────────────────────────────────────────
  const jajanBalance = jajanPocket?.balance || 0
  const savingPct    = profile?.saving_percent || 20

  // Sisa kebutuhan yang belum dikeluarkan minggu ini
  const sisaKebutuhan = Math.max(0, weeklyNeeds.total - weekActual.total)

  // Uang yang bisa dialokasikan (setelah dikurangi sisa kebutuhan)
  const tersedia = Math.max(0, jajanBalance - sisaKebutuhan)

  // Estimasi nabung dari jajan (pay yourself first)
  const estNabung = Math.round(tersedia * savingPct / 100)

  // Uang bebas (main/jajan) = tersedia - estimasi nabung
  const uangBebas = Math.max(0, tersedia - estNabung)

  // Mood maskot
  const mood = weekActual.jajan > estNabung * 2 ? 'sad'
             : estNabung > 0                    ? 'happy'
             : 'neutral'

  // ── Wishlist summary ───────────────────────────────────────
  const activeWishlist = wishlist.filter((w) => !w.is_completed).sort((a,b)=>a.priority-b.priority)
  const totalWishlistNeeded = activeWishlist.reduce((s,w) => s + Math.max(0, w.price - w.saved_amount), 0)
  const wishlistBalance = wishlistPocket?.balance || 0

  // ── Handlers ──────────────────────────────────────────────
  async function handleEditSave(pocket) {
    const val = parseInt(editAmount)
    if (isNaN(val) || val < 0) return
    setSubmitting(true)
    const { error } = await updatePocketBalance(pocket.id, val)
    setSubmitting(false)
    if (error) { toast('Gagal update 😢', 'error'); return }
    toast('Saldo diperbarui ✅', 'success')
    setEditingPocket(null); setEditAmount('')
  }

  async function handleTransferSubmit(e) {
    e.preventDefault()
    const amount = parseInt(transfer.amount)
    if (!amount || transfer.from === transfer.to) return
    const pMap = { jajan: jajanPocket, tabungan: tabunganPocket, wishlist: wishlistPocket }
    const fromP = pMap[transfer.from], toP = pMap[transfer.to]
    if (!fromP || !toP) return
    setSubmitting(true)
    const { error } = await transferBetweenPockets(fromP.id, toP.id, amount)
    setSubmitting(false)
    if (error) { toast(error, 'error'); return }
    toast(`${formatRupiah(amount)} dipindah ✅`, 'success')
    setTransfer((t) => ({ ...t, amount: '' }))
    setShowTransfer(false)
  }

  async function handleSisihkanNabung() {
    if (!jajanPocket || !tabunganPocket || estNabung <= 0) return
    setSubmitting(true)
    const { error } = await transferBetweenPockets(jajanPocket.id, tabunganPocket.id, estNabung)
    setSubmitting(false)
    if (error) { toast(error, 'error'); return }
    toast(`${formatRupiah(estNabung)} disisihkan ke Tabungan 🐷`, 'success')
  }

  async function handleSavePrevSaving() {
    const tab  = parseInt(prevSaving.tabungan) || 0
    const wish = parseInt(prevSaving.wishlist)  || 0
    if (tab === 0 && wish === 0) return
    setSubmitting(true)
    if (tab  > 0 && tabunganPocket) await updatePocketBalance(tabunganPocket.id, tabunganPocket.balance + tab)
    if (wish > 0 && wishlistPocket) await updatePocketBalance(wishlistPocket.id, wishlistPocket.balance + wish)
    setSubmitting(false)
    toast('Tabungan minggu lalu tersimpan ✅', 'success')
    setShowPrevSaving(false)
    setPrevSaving({ tabungan: '', wishlist: '' })
  }

  const pocketMeta = [
    { key:'jajan',    icon:'🍜', label:'Uang Jajan',       color:'peach',    pocket: jajanPocket },
    { key:'tabungan', icon:'🏦', label:'Tabungan',          color:'mint',     pocket: tabunganPocket },
    { key:'wishlist', icon:'✨', label:'Tabungan Wishlist', color:'lavender', pocket: wishlistPocket },
  ]

  const pocketOptions = [
    { value:'jajan',    label:'🍜 Uang Jajan' },
    { value:'tabungan', label:'🏦 Tabungan' },
    { value:'wishlist', label:'✨ Wishlist' },
  ]

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Nabung 🐷</h1>
      </header>

      <main className="page__content">

        {/* ── Pos Uang ── */}
        <div className="pocket-row">
          {pocketMeta.map(({ icon, label, color, pocket, key }) => (
            <div key={key} className={`pocket-card-sm pocket-card-sm--${color}`}>
              <span className="pocket-card-sm__icon">{icon}</span>
              <span className="pocket-card-sm__label">{label}</span>
              {editingPocket === pocket?.id ? (
                <div className="pocket-edit-inline">
                  <input type="number" className="form-input form-input--sm" value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)} placeholder="Saldo" inputMode="numeric" autoFocus />
                  <div style={{ display:'flex', gap:'4px', marginTop:'4px' }}>
                    <button className="btn btn--primary btn--xs" disabled={submitting} onClick={() => handleEditSave(pocket)}>✓</button>
                    <button className="btn btn--ghost btn--xs" onClick={() => { setEditingPocket(null); setEditAmount('') }}>✕</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="pocket-card-sm__amount">{formatRupiah(pocket?.balance || 0)}</span>
                  <button className="pocket-card-sm__edit"
                    onClick={() => { setEditingPocket(pocket?.id); setEditAmount(String(pocket?.balance || 0)) }}>
                    ✏️ edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Input Tabungan Minggu Lalu ── */}
        <div className="card card--hint">
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p className="card-hint__title">📦 Ada tabungan minggu lalu?</p>
              <p className="card-hint__sub">Masukkan saldo awal sebelum mulai minggu ini</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowPrevSaving(!showPrevSaving)}>
              {showPrevSaving ? 'Tutup' : 'Isi'}
            </button>
          </div>
          {showPrevSaving && (
            <div className="prev-saving-form">
              <div className="form-row" style={{ marginTop:'10px' }}>
                <div className="form-group">
                  <label className="form-label">🏦 Tambah ke Tabungan</label>
                  <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                    value={prevSaving.tabungan} onChange={(e) => setPrevSaving((p)=>({...p, tabungan: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">✨ Tambah ke Tabungan Wishlist</label>
                  <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                    value={prevSaving.wishlist} onChange={(e) => setPrevSaving((p)=>({...p, wishlist: e.target.value}))} />
                </div>
              </div>
              <button className="btn btn--primary btn--full" disabled={submitting} onClick={handleSavePrevSaving}>
                {submitting ? 'Menyimpan...' : '💾 Simpan Tabungan Lama'}
              </button>
            </div>
          )}
        </div>

        {/* ── Kalkulator Uang Minggu Ini ── */}
        <section className="card money-calc">
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' }}>
            <Mascot mood={mood} size={48} />
            <div>
              <h2 className="money-calc__title">Uangmu Minggu Ini</h2>
              <p className="money-calc__sub">Breakdown lengkap buat kamu 🔍</p>
            </div>
          </div>

          <div className="money-calc__rows">
            <MoneyRow icon="💰" label="Saldo uang jajan" value={jajanBalance} />
            <MoneyRow icon="🚌🍱" label={`Sisa kebutuhan rutin (${formatRupiah(weeklyNeeds.total, true)} total)`}
              value={-sisaKebutuhan} sub={`Sudah keluar: ${formatRupiah(weekActual.total, true)}`} isNeg />
            <div className="money-calc__divider" />
            <MoneyRow icon="💡" label="Tersedia setelah kebutuhan" value={tersedia} highlight />
            <MoneyRow icon="🐷" label={`Estimasi nabung (${savingPct}%)`} value={-estNabung} isNeg />
            <div className="money-calc__divider" />
            <MoneyRow icon="🎉" label="Uang bebas (main/jajan)" value={uangBebas} highlight big
              warn={weekActual.jajan > uangBebas ? `Jajan sudah ${formatRupiah(weekActual.jajan, true)}, melebihi anggaran!` : null} />
          </div>

          {/* Tombol sisihkan nabung */}
          {estNabung > 0 && (
            <button className="btn btn--primary btn--full" style={{ marginTop:'12px' }}
              disabled={submitting || !jajanPocket || !tabunganPocket}
              onClick={handleSisihkanNabung}>
              🐷 Sisihkan {formatRupiah(estNabung)} ke Tabungan sekarang
            </button>
          )}
        </section>

        {/* ── Tracking Harian ── */}
        <section className="card">
          <h2 className="section__title" style={{ marginBottom:'10px' }}>Tracking Harian 📅</h2>
          <div className="day-table">
            <div className="day-table__header">
              <span>Hari</span><span>Trans.</span><span>Makan</span><span>Total</span>
            </div>
            {weeklyNeeds.days.map((d) => {
              const dayTx       = transactions.filter((t)=>t.type==='expense' && t.date===d.dateStr)
              const dayTransport = dayTx.filter((t)=>t.category==='transport').reduce((s,t)=>s+t.amount,0)
              const dayMakan     = dayTx.filter((t)=>['makan_siang','makan_malam'].includes(t.category)).reduce((s,t)=>s+t.amount,0)
              const dayTotal     = dayTx.reduce((s,t)=>s+t.amount,0)
              const over         = d.isPast && dayTotal > d.total

              return (
                <div key={d.dateStr}
                  className={`day-table__row ${d.isToday?'day-table__row--today':''} ${d.isPast?'day-table__row--past':''}`}>
                  <span className="day-table__day">
                    {d.label}
                    {d.isWfh   && <span className="badge-sm badge-sm--wfh">WFH</span>}
                    {d.isToday && <span className="badge-sm badge-sm--today">hari ini</span>}
                  </span>
                  <span className={dayTransport > d.transport && d.transport > 0 ? 'text-over' : ''}>
                    {dayTransport > 0
                      ? formatRupiah(dayTransport, true)
                      : <span className="text-plan">{d.isWfh ? '-' : formatRupiah(d.transport, true)}</span>}
                  </span>
                  <span className={dayMakan > d.makan ? 'text-over' : ''}>
                    {dayMakan > 0
                      ? formatRupiah(dayMakan, true)
                      : <span className="text-plan">{formatRupiah(d.makan, true)}</span>}
                  </span>
                  <span className={over ? 'text-over fw-bold' : 'fw-bold'}>
                    {dayTotal > 0
                      ? formatRupiah(dayTotal, true)
                      : <span className="text-plan">{formatRupiah(d.total, true)}</span>}
                  </span>
                </div>
              )
            })}
            <div className="day-table__row day-table__row--total">
              <span>Total</span>
              <span>
                {formatRupiah(weekActual.transport,true)}
                <span className="text-plan"> /{formatRupiah(weeklyNeeds.transport,true)}</span>
              </span>
              <span>
                {formatRupiah(weekActual.makan,true)}
                <span className="text-plan"> /{formatRupiah(weeklyNeeds.makan,true)}</span>
              </span>
              <span className={weekActual.total > weeklyNeeds.total ? 'text-over fw-bold' : 'fw-bold'}>
                {formatRupiah(weekActual.total,true)}
                <span className="text-plan"> /{formatRupiah(weeklyNeeds.total,true)}</span>
              </span>
            </div>
          </div>
        </section>

        {/* ── Wishlist Progress ── */}
        {activeWishlist.length > 0 && (
          <section className="card">
            <h2 className="section__title" style={{ marginBottom:'10px' }}>Progress Wishlist ✨</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {activeWishlist.map((item) => {
                const kurang   = Math.max(0, item.price - item.saved_amount)
                const pct      = Math.min((item.saved_amount / item.price) * 100, 100)
                const weeksEst = estNabung > 0 && kurang > 0
                  ? Math.ceil(kurang / estNabung) : null

                return (
                  <div key={item.id} className="wishlist-mini">
                    <div className="wishlist-mini__row">
                      <span className="wishlist-mini__name">
                        <span className="wishlist-mini__pri">#{item.priority}</span> {item.name}
                      </span>
                      <span className="wishlist-mini__pct">{Math.round(pct)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-bar__fill progress-bar__fill--wishlist" style={{ width:`${pct}%` }} />
                    </div>
                    <div className="wishlist-mini__info">
                      <span>
                        <span style={{ color:'var(--c-mint)', fontWeight:700 }}>{formatRupiah(item.saved_amount)}</span>
                        {' / '}{formatRupiah(item.price)}
                      </span>
                      {kurang > 0 ? (
                        <span className="wishlist-mini__kurang">
                          Kurang <strong>{formatRupiah(kurang)}</strong>
                          {weeksEst && <span className="text-plan"> · ~{weeksEst} minggu</span>}
                        </span>
                      ) : (
                        <span style={{ color:'var(--c-mint)', fontWeight:700 }}>✅ Cukup!</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {totalWishlistNeeded > 0 && (
              <div className="wishlist-total-hint">
                <span>Total kurang untuk semua wishlist:</span>
                <strong>{formatRupiah(totalWishlistNeeded)}</strong>
              </div>
            )}
          </section>
        )}

        {/* ── Pindah Uang ── */}
        <section className="section">
          <button className="btn btn--ghost btn--full" onClick={() => setShowTransfer(!showTransfer)}>
            {showTransfer ? '✕ Tutup' : '↔ Pindah uang antar pos'}
          </button>
          {showTransfer && (
            <form className="card" onSubmit={handleTransferSubmit}>
              <div className="transfer-row">
                <select className="form-select" value={transfer.from}
                  onChange={(e) => setTransfer((t)=>({...t, from:e.target.value}))}>
                  {pocketOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="transfer-arrow">→</span>
                <select className="form-select" value={transfer.to}
                  onChange={(e) => setTransfer((t)=>({...t, to:e.target.value}))}>
                  {pocketOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginTop:'10px' }}>
                <input type="number" className="form-input" placeholder="Nominal (Rp)"
                  value={transfer.amount} onChange={(e) => setTransfer((t)=>({...t, amount:e.target.value}))}
                  inputMode="numeric" min="1" required />
              </div>
              <button type="submit" className="btn btn--primary btn--full"
                disabled={submitting || transfer.from===transfer.to || !transfer.amount}>
                💸 Pindahkan
              </button>
            </form>
          )}
        </section>

      </main>
    </div>
  )
}

// ── Sub-komponen ────────────────────────────────────────────
function MoneyRow({ icon, label, value, sub, isNeg, highlight, big, warn }) {
  return (
    <div className={`money-row ${highlight ? 'money-row--highlight' : ''}`}>
      <div className="money-row__left">
        <span className="money-row__icon">{icon}</span>
        <div>
          <span className="money-row__label">{label}</span>
          {sub && <span className="money-row__sub">{sub}</span>}
          {warn && <span className="money-row__warn">⚠️ {warn}</span>}
        </div>
      </div>
      <span className={`money-row__val ${big?'money-row__val--big':''} ${isNeg?'money-row__val--neg':''} ${highlight&&value>0?'money-row__val--pos':''}`}>
        {isNeg ? '-' : ''}{formatRupiah(Math.abs(value))}
      </span>
    </div>
  )
}
