import { useState, useMemo } from 'react'
import { usePockets } from '../hooks/usePockets'
import { usePocketHistory } from '../hooks/usePocketHistory'
import { useTransactions } from '../hooks/useTransactions'
import { useProfile } from '../hooks/useProfile'
import { useWishlist } from '../hooks/useWishlist'
import { useToast } from '../components/Toast'
import { formatRupiah, isWfhDay, getWeekDates, getLocalDateStr } from '../lib/utils'

export default function PocketsPage() {
  const { updatePocketBalance, transferBetweenPockets, getPocketByName } = usePockets()
  const { history: allHistory, loading: histLoading } = usePocketHistory()
  const { transactions } = useTransactions()
  const { profile } = useProfile()
  const { wishlist } = useWishlist()
  const toast = useToast()

  const [editP, setEditP]     = useState(null)
  const [editAmt, setEditAmt] = useState('')
  const [busy, setBusy]       = useState(false)
  const [showTr, setShowTr]   = useState(false)
  const [tr, setTr]           = useState({ from: 'jajan', to: 'tabungan', amount: '' })
  const [showPrev, setShowPrev] = useState(false)
  const [prev, setPrev]       = useState({ tabungan: '', wishlist: '' })
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'history'
  const [histFilter, setHistFilter] = useState('semua')  // 'semua' | 'jajan' | 'tabungan' | 'wishlist'

  const today     = new Date()
  const todayStr  = getLocalDateStr(today)
  const weekDates = getWeekDates(today)
  const weekStart = getLocalDateStr(weekDates[0])
  const weekEnd   = getLocalDateStr(weekDates[6])

  const jp = getPocketByName('jajan')
  const tp = getPocketByName('tabungan')
  const wp = getPocketByName('wishlist')

  // ── Kebutuhan rutin ───────────────────────────────────────
  const needs = useMemo(() => {
    if (!profile) return { transport: 0, makan: 0, total: 0, days: [] }
    const { transport_amount: ta = 14000, lunch_amount: la = 15000, dinner_amount: da = 20000, wfh_days: wfhd = [3] } = profile
    const workDays = weekDates.filter((d) => d.getDay() >= 1 && d.getDay() <= 5)
    const days = workDays.map((d) => {
      const ds  = getLocalDateStr(d)
      const wfh = isWfhDay(d, wfhd)
      return {
        label:   ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()],
        dateStr: ds,
        transport: wfh ? 0 : ta,
        makan:     la + da,
        total:     (wfh ? 0 : ta) + la + da,
        isWfh:   wfh,
        isPast:  ds < todayStr,
        isToday: ds === todayStr,
      }
    })
    return {
      transport: days.reduce((s, d) => s + d.transport, 0),
      makan:     days.reduce((s, d) => s + d.makan, 0),
      total:     days.reduce((s, d) => s + d.total, 0),
      days,
    }
  }, [profile, weekDates, todayStr])

  // ── Aktual minggu ini ─────────────────────────────────────
  const actual = useMemo(() => {
    const exp = transactions.filter((t) => t.type === 'expense' && t.date >= weekStart && t.date <= weekEnd)
    return {
      total:     exp.reduce((s, t) => s + t.amount, 0),
      transport: exp.filter((t) => t.category === 'transport').reduce((s, t) => s + t.amount, 0),
      makan:     exp.filter((t) => ['makan_siang','makan_malam'].includes(t.category)).reduce((s, t) => s + t.amount, 0),
      jajan:     exp.filter((t) => !['transport','makan_siang','makan_malam'].includes(t.category)).reduce((s, t) => s + t.amount, 0),
    }
  }, [transactions, weekStart, weekEnd])

  // ── Kalkulator ────────────────────────────────────────────
  const jajanBal      = jp?.balance || 0
  const savingPct     = profile?.saving_percent || 20
  const sisaKebutuhan = Math.max(0, needs.total - actual.total)
  const tersedia      = Math.max(0, jajanBal - sisaKebutuhan)
  const estNabung     = Math.round(tersedia * savingPct / 100)
  const uangBebas     = Math.max(0, tersedia - estNabung)

  // ── Cek apakah sudah sisihkan hari ini ───────────────────
  const sisihkanHariIni = useMemo(() => {
    const entry = allHistory.find((h) =>
      h.source === 'Sisihkan nabung dari Uang Jajan' &&
      h.pocket_name === 'tabungan' &&
      h.type === 'in' &&
      new Date(h.created_at).toLocaleDateString('en-CA') === todayStr
    )
    return entry || null
  }, [allHistory, todayStr])

  // ── Wishlist ──────────────────────────────────────────────
  const activeWL    = wishlist.filter((w) => !w.is_completed).sort((a, b) => a.priority - b.priority)
  const totalKurang = activeWL.reduce((s, w) => s + Math.max(0, w.price - w.saved_amount), 0)

  // ── Handlers ─────────────────────────────────────────────
  async function saveEdit(key, p) {
    if (!p) { toast('Pocket tidak ditemukan', 'error'); return }
    const v = parseInt(editAmt)
    if (isNaN(v) || v < 0) { toast('Nominal tidak valid', 'error'); return }
    setBusy(true)
    const { error } = await updatePocketBalance(p.id, v)
    setBusy(false)
    if (error) { toast('Gagal update', 'error'); return }
    toast('Saldo diperbarui ✓', 'success')
    setEditP(null); setEditAmt('')
  }

  async function submitTransfer(e) {
    e.preventDefault()
    const amt = parseInt(tr.amount)
    if (!amt || tr.from === tr.to) return
    const pm  = { jajan: jp, tabungan: tp, wishlist: wp }
    const fp  = pm[tr.from], toP = pm[tr.to]
    if (!fp || !toP) return
    setBusy(true)
    const { error } = await transferBetweenPockets(fp.id, toP.id, amt, {
      source: `Transfer: ${fp.name} → ${toP.name}`,
    })
    setBusy(false)
    if (error) { toast(error, 'error'); return }
    toast(`${formatRupiah(amt)} dipindah ✓`, 'success')
    setTr((t) => ({ ...t, amount: '' }))
    setShowTr(false)
  }

  async function sisihkan() {
    if (!jp || !tp || estNabung <= 0) return
    setBusy(true)
    const { error } = await transferBetweenPockets(jp.id, tp.id, estNabung, {
      source: 'Sisihkan nabung dari Uang Jajan',
    })
    setBusy(false)
    if (error) { toast(error, 'error'); return }
    toast(`${formatRupiah(estNabung)} disisihkan ke Tabungan`, 'success')
  }

  async function savePrev() {
    const tabAmt  = parseInt(prev.tabungan) || 0
    const wishAmt = parseInt(prev.wishlist)  || 0
    if (!tabAmt && !wishAmt) return
    setBusy(true)
    if (tabAmt  && tp) await updatePocketBalance(tp.id, tp.balance + tabAmt)
    if (wishAmt && wp) await updatePocketBalance(wp.id, wp.balance + wishAmt)
    setBusy(false)
    toast('Tabungan lama tersimpan ✓', 'success')
    setShowPrev(false); setPrev({ tabungan: '', wishlist: '' })
  }

  const pocketDef = [
    { key: 'jajan',    icon: '🍜', label: 'Uang Jajan',  cls: 'peach', p: jp },
    { key: 'tabungan', icon: '🏦', label: 'Tabungan',     cls: 'mint',  p: tp },
    { key: 'wishlist', icon: '✨', label: 'Tab. Wishlist', cls: 'lav',   p: wp },
  ]

  const PO = [
    { value: 'jajan',    label: '🍜 Uang Jajan' },
    { value: 'tabungan', label: '🏦 Tabungan' },
    { value: 'wishlist', label: '✨ Wishlist' },
  ]

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Nabung 🐷</h1>
      </div>

      <div className="page__content">

        {activeTab === 'overview' && (<>

        {/* ── Pos Uang ── */}
        <div className="pocket-grid">
          {pocketDef.map(({ key, icon, label, cls, p }) => (
            <div key={key} className={`p-card p-card--${cls}`}>
              <span className="p-card__icon">{icon}</span>
              <span className="p-card__label">{label}</span>

              {editP === key ? (
                <div style={{ width: '100%' }}>
                  <input
                    type="number" className="form-input form-input--sm"
                    value={editAmt} onChange={(e) => setEditAmt(e.target.value)}
                    placeholder="0" inputMode="numeric" autoFocus
                    style={{ marginBottom: 6 }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(key, p) } }}
                  />
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn--primary btn--xs" disabled={busy} onClick={() => saveEdit(key, p)}>
                      {busy ? '...' : '✓'}
                    </button>
                    <button className="btn btn--ghost btn--xs" onClick={() => { setEditP(null); setEditAmt('') }}>✕</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="p-card__val">{formatRupiah(p?.balance || 0)}</span>
                  <button className="p-card__edit" onClick={() => { setEditP(key); setEditAmt(String(p?.balance || 0)) }}>
                    ✏️ edit
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Tabungan minggu lalu ── */}
        <div className="card" style={{ background: 'rgba(251,191,36,.08)', borderColor: 'rgba(251,191,36,.25)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div>
              <p style={{ fontWeight: 700, fontSize: '0.87rem' }}>📦 Ada tabungan dari minggu lalu?</p>
              <p style={{ fontSize: '0.73rem', color: 'var(--t3)', marginTop: 2 }}>Masukkan saldo awal sebelum mulai minggu ini</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={() => setShowPrev(!showPrev)} style={{ flexShrink: 0 }}>
              {showPrev ? 'Tutup' : 'Isi'}
            </button>
          </div>

          {showPrev && (
            <div style={{ marginTop: 14 }}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tambah ke Tabungan</label>
                  <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                    value={prev.tabungan} onChange={(e) => setPrev((p) => ({ ...p, tabungan: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tambah ke Wishlist</label>
                  <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                    value={prev.wishlist} onChange={(e) => setPrev((p) => ({ ...p, wishlist: e.target.value }))} />
                </div>
              </div>
              <button className="btn btn--primary btn--full" disabled={busy} onClick={savePrev}>
                {busy ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          )}
        </div>

        {/* ── Kalkulator Uang ── */}
        <div className="card">
          <p className="s-title" style={{ marginBottom: 14 }}>Uangmu Minggu Ini 🔍</p>

          <div className="calc-list">
            <CalcRow icon="💰" label="Saldo uang jajan" val={jajanBal} />
            <CalcRow
              icon="🚌"
              label="Sisa kebutuhan rutin"
              sub={`Rencana ${formatRupiah(needs.total, true)} · keluar ${formatRupiah(actual.total, true)}`}
              val={-sisaKebutuhan} neg
            />
            <div className="calc-div" />
            <CalcRow icon="✅" label="Tersedia setelah kebutuhan" val={tersedia} hl />
            <CalcRow icon="🐷" label={`Estimasi nabung (${savingPct}%)`} val={-estNabung} neg />
            <div className="calc-div" />
            <CalcRow
              icon="🎉"
              label="Uang bebas — buat main/jajan"
              val={uangBebas} free big
              warn={actual.jajan > uangBebas ? `Sudah jajan ${formatRupiah(actual.jajan, true)}, melebihi budget!` : null}
            />
          </div>

          {estNabung > 0 && jp && tp && (
            <div style={{ marginTop: 14 }}>
              {sisihkanHariIni ? (
                /* Sudah sisihkan hari ini */
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(52,211,153,.1)',
                  border: '1px solid rgba(52,211,153,.25)',
                  borderRadius: 'var(--r2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}>
                  <span style={{ fontSize: '1.1rem' }}>✅</span>
                  <div>
                    <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--green)' }}>
                      Sudah disisihkan hari ini
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: 2 }}>
                      {formatRupiah(sisihkanHariIni.amount)} ke Tabungan ·{' '}
                      {new Date(sisihkanHariIni.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ) : (
                <button className="btn btn--primary btn--full" disabled={busy} onClick={sisihkan}>
                  Sisihkan {formatRupiah(estNabung)} ke Tabungan
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Tracking Harian ── */}
        <div className="card">
          <p className="s-title" style={{ marginBottom: 10 }}>Tracking Harian 📅</p>
          <div className="day-table">
            <div className="day-table__head">
              <span>Hari</span><span>Trans.</span><span>Makan</span><span>Total</span>
            </div>
            {needs.days.map((d) => {
              const dt   = transactions.filter((t) => t.type === 'expense' && t.date === d.dateStr)
              const dtr  = dt.filter((t) => t.category === 'transport').reduce((s, t) => s + t.amount, 0)
              const dmk  = dt.filter((t) => ['makan_siang','makan_malam'].includes(t.category)).reduce((s, t) => s + t.amount, 0)
              const dtot = dt.reduce((s, t) => s + t.amount, 0)
              return (
                <div key={d.dateStr}
                  className={`day-table__row ${d.isToday ? 'day-table__row--today' : ''} ${d.isPast ? 'day-table__row--past' : ''}`}>
                  <span className="day-table__day">
                    {d.label}
                    {d.isWfh   && <span className="badge badge--wfh">WFH</span>}
                    {d.isToday && <span className="badge badge--today">hari ini</span>}
                  </span>
                  <span className={dtr > d.transport && d.transport > 0 ? 'red' : ''}>
                    {dtr > 0 ? formatRupiah(dtr, true) : <span className="t3">{d.isWfh ? '-' : formatRupiah(d.transport, true)}</span>}
                  </span>
                  <span className={dmk > d.makan ? 'red' : ''}>
                    {dmk > 0 ? formatRupiah(dmk, true) : <span className="t3">{formatRupiah(d.makan, true)}</span>}
                  </span>
                  <span className={dtot > d.total && d.isPast ? 'red fw7' : 'fw7'}>
                    {dtot > 0 ? formatRupiah(dtot, true) : <span className="t3">{formatRupiah(d.total, true)}</span>}
                  </span>
                </div>
              )
            })}
            <div className="day-table__row day-table__row--total">
              <span>Total</span>
              <span>{formatRupiah(actual.transport, true)} <span className="t3">/{formatRupiah(needs.transport, true)}</span></span>
              <span>{formatRupiah(actual.makan, true)} <span className="t3">/{formatRupiah(needs.makan, true)}</span></span>
              <span className={actual.total > needs.total ? 'red fw7' : 'fw7'}>
                {formatRupiah(actual.total, true)} <span className="t3">/{formatRupiah(needs.total, true)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Wishlist Progress ── */}
        {activeWL.length > 0 && (
          <div className="card">
            <p className="s-title" style={{ marginBottom: 12 }}>Progress Wishlist ✨</p>
            {activeWL.map((item) => {
              const kurang   = Math.max(0, item.price - item.saved_amount)
              const pct      = Math.min((item.saved_amount / item.price) * 100, 100)
              const weeksEst = estNabung > 0 && kurang > 0 ? Math.ceil(kurang / estNabung) : null
              return (
                <div key={item.id} style={{ borderBottom: '1px solid rgba(255,255,255,.06)', paddingBottom: 10, marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <p style={{ fontWeight: 600, fontSize: '0.86rem' }}>
                      <span style={{ fontSize: '0.6rem', background: 'rgba(167,139,250,.2)', color: 'var(--violet)', padding: '1px 6px', borderRadius: 99, marginRight: 5, fontWeight: 700 }}>
                        #{item.priority}
                      </span>
                      {item.name}
                    </p>
                    <p style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--violet)' }}>{Math.round(pct)}%</p>
                  </div>
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--t3)', marginTop: 5 }}>
                    <span>{formatRupiah(item.saved_amount)} / {formatRupiah(item.price)}</span>
                    {kurang > 0
                      ? <span>kurang <span className="red" style={{ fontWeight: 700 }}>{formatRupiah(kurang, true)}</span>
                          {weeksEst && <span className="t3"> · ~{weeksEst} minggu</span>}
                        </span>
                      : <span className="grn fw7">✓ Cukup!</span>
                    }
                  </div>
                </div>
              )
            })}
            {totalKurang > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', paddingTop: 4 }}>
                <span className="t3">Total kurang semua wishlist</span>
                <span className="fw7">{formatRupiah(totalKurang)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Pindah uang ── */}
        <button className="btn btn--ghost btn--full" onClick={() => setShowTr(!showTr)}>
          {showTr ? 'Tutup' : '↔ Pindah uang antar pos'}
        </button>

        {showTr && (
          <form className="card" onSubmit={submitTransfer}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <select className="form-select" value={tr.from} onChange={(e) => setTr((t) => ({ ...t, from: e.target.value }))}>
                {PO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="t3" style={{ flexShrink: 0 }}>→</span>
              <select className="form-select" value={tr.to} onChange={(e) => setTr((t) => ({ ...t, to: e.target.value }))}>
                {PO.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <input type="number" className="form-input" placeholder="Nominal (Rp)"
                value={tr.amount} onChange={(e) => setTr((t) => ({ ...t, amount: e.target.value }))}
                inputMode="numeric" min="1" required />
            </div>
            <button type="submit" className="btn btn--primary btn--full"
              disabled={busy || tr.from === tr.to || !tr.amount}>
              Pindahkan
            </button>
          </form>
        )}

        </>)}

        {/* ── Tab bar Overview / History ── */}
        <div className="tabs" style={{ marginTop: 4 }}>
          <button className={`tabs__tab ${activeTab === 'overview' ? 'tabs__tab--active' : ''}`}
            onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`tabs__tab ${activeTab === 'history' ? 'tabs__tab--active' : ''}`}
            onClick={() => setActiveTab('history')}>Riwayat Saldo</button>
        </div>

        {/* ── History Section ── */}
        {activeTab === 'history' && (
          <div>
            {/* Filter per pos */}
            <div className="filter-chips" style={{ marginBottom: 10 }}>
              {[
                { key: 'semua',    label: 'Semua' },
                { key: 'jajan',    label: '🍜 Jajan' },
                { key: 'tabungan', label: '🏦 Tabungan' },
                { key: 'wishlist', label: '✨ Wishlist' },
              ].map((f) => (
                <button key={f.key} className={`chip ${histFilter === f.key ? 'chip--active' : ''}`}
                  onClick={() => setHistFilter(f.key)}>
                  {f.label}
                </button>
              ))}
            </div>

            {histLoading ? (
              <p style={{ color: 'var(--t3)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>Memuat...</p>
            ) : (() => {
              const filtered = histFilter === 'semua'
                ? allHistory
                : allHistory.filter((h) => h.pocket_name === histFilter)
              if (filtered.length === 0) return (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <div className="empty-state__icon">📋</div>
                  <p>Belum ada riwayat</p>
                  <p className="t3">Mulai catat transaksi untuk melihat riwayat saldo</p>
                </div>
              )
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {filtered.map((h) => {
                    const isIn = h.type === 'in'
                    const pocketLabel = { jajan: '🍜 Uang Jajan', tabungan: '🏦 Tabungan', wishlist: '✨ Wishlist' }[h.pocket_name] || h.pocket_name
                    const dt = new Date(h.created_at)
                    const dateStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    const timeStr = dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                    return (
                      <div key={h.id} style={{
                        background: 'var(--g)', border: '1px solid var(--g-b)',
                        borderRadius: 'var(--r2)', padding: '11px 13px',
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        borderLeft: `3px solid ${isIn ? 'var(--green)' : 'var(--red)'}`,
                      }}>
                        {/* Icon */}
                        <div style={{
                          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isIn ? 'rgba(52,211,153,.15)' : 'rgba(248,113,113,.15)',
                          fontSize: '1rem',
                        }}>
                          {isIn ? '↑' : '↓'}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>{h.source}</p>
                          {h.note && <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: 1 }}>{h.note}</p>}
                          <p style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 3 }}>
                            {pocketLabel} · {dateStr} {timeStr}
                          </p>
                        </div>
                        {/* Amount + saldo setelah */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{
                            fontWeight: 700, fontSize: '0.9rem',
                            color: isIn ? 'var(--green)' : 'var(--red)',
                          }}>
                            {isIn ? '+' : '-'}{formatRupiah(h.amount)}
                          </p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 2 }}>
                            saldo: {formatRupiah(h.balance_after)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
          </div>
        )}

      </div>
    </div>
  )
}

/* ── Sub-komponen CalcRow ── */
function CalcRow({ icon, label, val, sub, warn, neg, hl, free, big }) {
  return (
    <div className={`calc-row ${hl ? 'calc-row--hl' : ''} ${free ? 'calc-row--free' : ''}`}>
      <div className="calc-row__l">
        <span className="calc-row__icon">{icon}</span>
        <div>
          <span className="calc-row__lbl">{label}</span>
          {sub  && <span className="calc-row__sub">{sub}</span>}
          {warn && <span className="calc-row__warn">⚠️ {warn}</span>}
        </div>
      </div>
      <span className={[
        'calc-row__val',
        big  ? 'calc-row__val--big' : '',
        neg  ? 'calc-row__val--neg' : '',
        hl   ? 'calc-row__val--vio' : '',
        free ? 'calc-row__val--pos' : '',
      ].filter(Boolean).join(' ')}>
        {neg ? '-' : ''}{formatRupiah(Math.abs(val))}
      </span>
    </div>
  )
}
