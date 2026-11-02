import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { usePockets } from '../hooks/usePockets'
import { useProfile } from '../hooks/useProfile'
import { formatRupiah, getWeekDates, getLocalDateStr } from '../lib/utils'

const CAT_LABEL = {
  transport: 'Transport', makan_siang: 'Makan Siang', makan_malam: 'Makan Malam',
  jajan: 'Jajan', lainnya: 'Lainnya', uang_saku: 'Uang Saku', gaji_magang: 'Gaji Magang',
}
const CAT_COLOR = {
  transport: '#60a5fa', makan_siang: '#34d399', makan_malam: '#a78bfa',
  jajan: '#f472b6', lainnya: '#fb923c',
}

export default function InsightsPage() {
  const { transactions } = useTransactions()
  const { getPocketByName } = usePockets()
  const { profile } = useProfile()
  const [period, setPeriod] = useState('minggu')
  // Kalkulator
  const [calcIncome,  setCalcIncome]  = useState('')
  const [calcExpense, setCalcExpense] = useState('')
  const [calcResult,  setCalcResult]  = useState(null)

  const today = new Date()
  const jp = getPocketByName('jajan')
  const tp = getPocketByName('tabungan')
  const wp = getPocketByName('wishlist')

  // ── Range tanggal ─────────────────────────────────────────
  const { startStr, endStr, label: periodLabel } = useMemo(() => {
    if (period === 'minggu') {
      const wd = getWeekDates(today)
      return { startStr: getLocalDateStr(wd[0]), endStr: getLocalDateStr(wd[6]), label: 'Minggu ini' }
    }
    if (period === 'bulan') {
      const y = today.getFullYear(), m = today.getMonth()
      return {
        startStr: getLocalDateStr(new Date(y, m, 1)),
        endStr:   getLocalDateStr(new Date(y, m + 1, 0)),
        label: today.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
      }
    }
    // semua waktu
    return { startStr: '2000-01-01', endStr: '2099-12-31', label: 'Semua waktu' }
  }, [period]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Kalkulasi data ────────────────────────────────────────
  const periodTx = useMemo(() =>
    transactions.filter((t) => t.date >= startStr && t.date <= endStr),
    [transactions, startStr, endStr])

  const totalIncome  = useMemo(() => periodTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0), [periodTx])
  const totalExpense = useMemo(() => periodTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [periodTx])
  const netFlow      = totalIncome - totalExpense

  // Per kategori
  const byCategory = useMemo(() => {
    const grouped = {}
    for (const t of periodTx.filter((tx) => tx.type === 'expense')) {
      grouped[t.category] = (grouped[t.category] || 0) + t.amount
    }
    return Object.entries(grouped)
      .map(([cat, val]) => ({ cat, val, label: CAT_LABEL[cat] || cat, color: CAT_COLOR[cat] || '#94a3b8' }))
      .sort((a, b) => b.val - a.val)
  }, [periodTx])

  const biggestCat = byCategory[0]
  const savingRate = totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0

  // Estimasi kebutuhan mingguan dari profile
  const weeklyNeed = useMemo(() => {
    if (!profile) return 0
    const { transport_amount: ta=14000, lunch_amount: la=15000, dinner_amount: da=20000, wfh_days: wfhd=[3] } = profile
    const wfhCount = (wfhd || []).filter((d) => d >= 1 && d <= 5).length
    return ta * (5 - wfhCount) + (la + da) * 5
  }, [profile])

  // ── Kalkulator ────────────────────────────────────────────
  function runCalc() {
    const inc = parseFloat(calcIncome) || 0
    const exp = parseFloat(calcExpense) || 0
    const sisa = inc - exp
    const savingPct = profile?.saving_percent || 20
    const bisa_nabung = Math.max(0, Math.round(sisa * savingPct / 100))
    const bebas = Math.max(0, sisa - bisa_nabung)
    setCalcResult({ sisa, bisa_nabung, bebas, savingPct })
  }

  const PERIODS = [
    { key: 'minggu', label: 'Minggu ini' },
    { key: 'bulan',  label: 'Bulan ini'  },
    { key: 'semua',  label: 'Semua'      },
  ]

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Insights 📊</h1>
      </div>

      <div className="page__content">

        {/* ── Filter periode ── */}
        <div className="tabs">
          {PERIODS.map((p) => (
            <button key={p.key} className={`tabs__tab ${period === p.key ? 'tabs__tab--active' : ''}`}
              onClick={() => setPeriod(p.key)}>
              {p.label}
            </button>
          ))}
        </div>

        {/* ── Ringkasan uang masuk/keluar ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card" style={{ background: 'rgba(52,211,153,.1)', borderColor: 'rgba(52,211,153,.2)' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--green)', marginBottom: 6 }}>
              Masuk
            </p>
            <p style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.03em' }}>{formatRupiah(totalIncome)}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: 4 }}>
              {periodTx.filter((t) => t.type === 'income').length} transaksi
            </p>
          </div>
          <div className="card" style={{ background: 'rgba(248,113,113,.1)', borderColor: 'rgba(248,113,113,.2)' }}>
            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--red)', marginBottom: 6 }}>
              Keluar
            </p>
            <p style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.03em' }}>{formatRupiah(totalExpense)}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--t3)', marginTop: 4 }}>
              {periodTx.filter((t) => t.type === 'expense').length} transaksi
            </p>
          </div>
        </div>

        {/* ── Net flow card ── */}
        <div className="card" style={{
          background: netFlow >= 0 ? 'rgba(52,211,153,.08)' : 'rgba(248,113,113,.08)',
          borderColor: netFlow >= 0 ? 'rgba(52,211,153,.2)' : 'rgba(248,113,113,.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: '0.72rem', color: 'var(--t2)', marginBottom: 4 }}>Net — {periodLabel}</p>
              <p style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.04em', color: netFlow >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {netFlow >= 0 ? '+' : ''}{formatRupiah(netFlow)}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.68rem', color: 'var(--t3)' }}>Saving rate</p>
              <p style={{ fontWeight: 800, fontSize: '1.3rem', color: savingRate > 0 ? 'var(--violet)' : 'var(--red)' }}>
                {savingRate}%
              </p>
            </div>
          </div>

          {/* Progress saving rate */}
          <div style={{ marginTop: 12 }}>
            <div className="prog-track">
              <div className="prog-fill" style={{
                width: `${Math.min(Math.abs(savingRate), 100)}%`,
                background: savingRate >= 20 ? 'var(--gg)' : savingRate >= 0 ? 'var(--go)' : 'var(--red)',
              }} />
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--t3)', marginTop: 5 }}>
              {savingRate >= 20 ? '✓ Saving rate bagus!' : savingRate >= 0 ? '⚠️ Coba tingkatkan saving rate ke 20%+' : '❌ Pengeluaran melebihi pemasukan'}
            </p>
          </div>
        </div>

        {/* ── Saldo semua pos ── */}
        <div className="card">
          <p className="s-title" style={{ marginBottom: 12 }}>Saldo Semua Pos</p>
          {[
            { icon: '🍜', label: 'Uang Jajan',       val: jp?.balance || 0, color: '#fb923c' },
            { icon: '🏦', label: 'Tabungan',          val: tp?.balance || 0, color: '#34d399' },
            { icon: '✨', label: 'Tabungan Wishlist', val: wp?.balance || 0, color: '#a78bfa' },
          ].map(({ icon, label, val }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{formatRupiah(val)}</span>
                </div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--t2)' }}>Total aset</span>
            <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--violet)' }}>
              {formatRupiah((jp?.balance || 0) + (tp?.balance || 0) + (wp?.balance || 0))}
            </span>
          </div>
        </div>

        {/* ── Pengeluaran per kategori ── */}
        {byCategory.length > 0 && (
          <div className="card">
            <p className="s-title" style={{ marginBottom: 12 }}>Pengeluaran per Kategori</p>
            {byCategory.map(({ cat, val, label, color }) => {
              const pct = totalExpense > 0 ? (val / totalExpense) * 100 : 0
              return (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</span>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>{formatRupiah(val)}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--t3)', marginLeft: 6 }}>{Math.round(pct)}%</span>
                    </div>
                  </div>
                  <div className="prog-track">
                    <div className="prog-fill" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              )
            })}
            {biggestCat && (
              <p style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--t3)', padding: '8px 10px', background: 'rgba(255,255,255,.04)', borderRadius: 8 }}>
                💡 Pengeluaran terbesar: <strong style={{ color: 'var(--t1)' }}>{biggestCat.label}</strong> ({formatRupiah(biggestCat.val)})
              </p>
            )}
          </div>
        )}

        {/* ── Estimasi kebutuhan ── */}
        <div className="card">
          <p className="s-title" style={{ marginBottom: 12 }}>Estimasi vs Aktual Minggu Ini</p>
          {[
            { label: 'Estimasi kebutuhan', val: weeklyNeed, color: 'var(--violet)' },
            { label: 'Aktual pengeluaran', val: (() => {
              const wd = getWeekDates(today)
              const ws = getLocalDateStr(wd[0]), we = getLocalDateStr(wd[6])
              return transactions.filter((t) => t.type === 'expense' && t.date >= ws && t.date <= we).reduce((s, t) => s + t.amount, 0)
            })(), color: totalExpense > weeklyNeed ? 'var(--red)' : 'var(--green)' },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--t2)' }}>{label}</span>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color }}>{formatRupiah(val)}</span>
            </div>
          ))}
        </div>

        {/* ── Kalkulator ── */}
        <div className="card">
          <p className="s-title" style={{ marginBottom: 4 }}>Kalkulator Nabung 🧮</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--t3)', marginBottom: 14 }}>
            Masukkan uang masuk dan perkiraan pengeluaran untuk tahu berapa yang bisa ditabung
          </p>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Uang masuk (Rp)</label>
              <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                value={calcIncome} onChange={(e) => setCalcIncome(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Perkiraan keluar (Rp)</label>
              <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                value={calcExpense} onChange={(e) => setCalcExpense(e.target.value)} />
            </div>
          </div>

          <button className="btn btn--primary btn--full" onClick={runCalc}
            disabled={!calcIncome && !calcExpense}>
            Hitung
          </button>

          {calcResult && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Sisa setelah pengeluaran', val: calcResult.sisa, color: calcResult.sisa >= 0 ? 'var(--green)' : 'var(--red)' },
                { label: `Bisa ditabung (${calcResult.savingPct}%)`, val: calcResult.bisa_nabung, color: 'var(--violet)' },
                { label: 'Uang bebas (main/jajan)', val: calcResult.bebas, color: 'var(--accent-3, #34d399)' },
              ].map(({ label, val, color }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 10,
                }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--t2)' }}>{label}</span>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem', color }}>{formatRupiah(Math.abs(val))}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Riwayat transaksi — dikelompokkan per tanggal ── */}
        <TxByDate transactions={periodTx} periodLabel={periodLabel} />

        {/* ── Link ke Pengaturan ── */}
        <div style={{ textAlign: 'center', paddingTop: 8 }}>
          <Link to="/pengaturan" style={{ fontSize: '0.78rem', color: 'var(--t3)' }}>
            ⚙️ Pengaturan
          </Link>
        </div>

      </div>
    </div>
  )
}

/* ── Komponen riwayat per tanggal ── */
const CAT_ICON_MAP = { transport:'🚌', makan_siang:'🍱', makan_malam:'🍜', jajan:'🧋', lainnya:'📦' }

function TxByDate({ transactions, periodLabel }) {
  const [showAll, setShowAll] = useState(false)

  // Grup per tanggal, urutan terbaru dulu
  const grouped = useMemo(() => {
    const map = {}
    for (const tx of [...transactions].sort((a, b) => b.date.localeCompare(a.date))) {
      if (!map[tx.date]) map[tx.date] = []
      map[tx.date].push(tx)
    }
    return Object.entries(map) // [['2026-11-02', [...tx]], ...]
  }, [transactions])

  const visibleGroups = showAll ? grouped : grouped.slice(0, 3)

  if (transactions.length === 0) {
    return (
      <div className="card">
        <p className="s-title" style={{ marginBottom: 12 }}>Riwayat — {periodLabel}</p>
        <div className="empty-state" style={{ padding: '20px 0' }}>
          <div className="empty-state__icon">🧾</div>
          <p>Belum ada transaksi</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <p className="s-title">Riwayat — {periodLabel}</p>
        <span style={{ fontSize: '0.72rem', color: 'var(--t3)' }}>{transactions.length} transaksi</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visibleGroups.map(([dateStr, txs]) => {
          const dayTotal = txs.reduce((s, t) => t.type === 'expense' ? s - t.amount : s + t.amount, 0)
          const dateObj  = new Date(dateStr + 'T12:00:00')
          const today    = new Date()
          const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)

          let dayLabel = dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })
          if (dateStr === today.toISOString().split('T')[0])     dayLabel = `Hari ini · ${dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`
          if (dateStr === yesterday.toISOString().split('T')[0]) dayLabel = `Kemarin · ${dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}`

          return (
            <div key={dateStr}>
              {/* Header tanggal */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {dayLabel}
                </span>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 700,
                  color: dayTotal >= 0 ? 'var(--green)' : 'var(--red)',
                }}>
                  {dayTotal >= 0 ? '+' : ''}{formatRupiah(dayTotal)}
                </span>
              </div>

              {/* Transaksi per hari */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {txs.map((tx, i) => (
                  <div key={tx.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 0',
                    borderBottom: i < txs.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                  }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: tx.type === 'income' ? 'rgba(52,211,153,.15)' : 'rgba(167,139,250,.12)',
                      fontSize: '0.88rem',
                    }}>
                      {tx.type === 'income' ? '💰' : (CAT_ICON_MAP[tx.category] || '📦')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.83rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {tx.note || CAT_LABEL[tx.category] || tx.category}
                      </p>
                      <p style={{ fontSize: '0.68rem', color: 'var(--t3)', marginTop: 1 }}>
                        {CAT_LABEL[tx.category] || tx.category}
                      </p>
                    </div>
                    <span style={{
                      fontWeight: 700, fontSize: '0.85rem', flexShrink: 0,
                      color: tx.type === 'income' ? 'var(--green)' : 'var(--t1)',
                    }}>
                      {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tombol lihat semua */}
      {grouped.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            width: '100%', marginTop: 14,
            padding: '8px', borderRadius: 'var(--r1)',
            fontSize: '0.78rem', fontWeight: 600,
            color: 'var(--violet)',
            background: 'rgba(167,139,250,.1)',
            border: '1px solid rgba(167,139,250,.2)',
            cursor: 'pointer', fontFamily: 'var(--ff)',
          }}
        >
          {showAll ? 'Tampilkan lebih sedikit ↑' : `Lihat semua ${grouped.length} hari ↓`}
        </button>
      )}
    </div>
  )
}
