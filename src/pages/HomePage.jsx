import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions } from '../hooks/useTransactions'
import { usePockets } from '../hooks/usePockets'
import { useWishlist } from '../hooks/useWishlist'
import { useProfile } from '../hooks/useProfile'
import { formatRupiah, getWeekDates, isWfhDay } from '../lib/utils'

export default function HomePage() {
  const { transactions } = useTransactions()
  const { getPocketByName } = usePockets()
  const { wishlist } = useWishlist()
  const { profile } = useProfile()

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const isWFH    = profile ? isWfhDay(today, profile.wfh_days) : false

  const jp = getPocketByName('jajan')
  const tp = getPocketByName('tabungan')
  const wp = getPocketByName('wishlist')

  const todayOut = useMemo(() =>
    transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s, t) => s + t.amount, 0),
    [transactions, todayStr])

  const todayIn = useMemo(() =>
    transactions.filter((t) => t.type === 'income' && t.date === todayStr).reduce((s, t) => s + t.amount, 0),
    [transactions, todayStr])

  const dailyNeed = useMemo(() => {
    if (!profile) return 0
    const tr = isWFH ? 0 : (profile.transport_amount || 14000)
    return tr + (profile.lunch_amount || 15000) + (profile.dinner_amount || 20000)
  }, [profile, isWFH])

  const weekDates  = getWeekDates(today)
  const weeklyData = useMemo(() =>
    weekDates.map((d) => {
      const ds    = d.toISOString().split('T')[0]
      const total = transactions
        .filter((t) => t.type === 'expense' && t.date === ds)
        .reduce((s, t) => s + t.amount, 0)
      return { ds, total, label: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()] }
    }), [transactions, weekDates])
  const maxW = Math.max(...weeklyData.map((d) => d.total), 1)

  const topWL = wishlist.filter((w) => !w.is_completed).sort((a, b) => a.priority - b.priority)[0]

  const h = today.getHours()
  const greeting = h < 11 ? 'Selamat pagi ☀️' : h < 15 ? 'Selamat siang 🌤' : h < 18 ? 'Selamat sore 🌅' : 'Selamat malam 🌙'

  return (
    <div className="page">

      {/* ── Header ── */}
      <div className="home-header">
        <div>
          <p className="home-header__greeting">{greeting}</p>
          <h1 className="home-header__name">duit.ku</h1>
          <p className="home-header__date">
            {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
            {isWFH && <span className="wfh-pill">WFH</span>}
          </p>
        </div>
        <Link to="/transaksi">
          <div style={{
            width: 42, height: 42,
            background: 'var(--gv)',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.3rem', fontWeight: 800,
            boxShadow: '0 4px 16px rgba(167,139,250,.4)',
          }}>+</div>
        </Link>
      </div>

      {/* ── Hero card ── */}
      <div className="hero-card">
        <div className="hero-card__deco1" />
        <div className="hero-card__deco2" />
        <div className="hero-card__top">
          <div>
            <p className="hero-card__label">Uang Jajan</p>
            <p className="hero-card__amount">{formatRupiah(jp?.balance || 0)}</p>
          </div>
          <Link to="/tabungan" className="btn btn--ghost btn--sm"
            style={{ position: 'relative', zIndex: 1 }}>
            Kelola
          </Link>
        </div>
        <div className="hero-card__stats">
          <div className="h-stat">
            <p className="h-stat__lbl">Keluar hari ini</p>
            <p className="h-stat__val">{formatRupiah(todayOut)}</p>
          </div>
          <div className="h-stat">
            <p className="h-stat__lbl">Budget harian</p>
            <p className="h-stat__val">{formatRupiah(dailyNeed)}</p>
          </div>
          <div className="h-stat">
            <p className="h-stat__lbl">Masuk hari ini</p>
            <p className="h-stat__val">{todayIn > 0 ? `+${formatRupiah(todayIn)}` : '—'}</p>
          </div>
        </div>
        {todayOut > dailyNeed && (
          <p className="hero-card__warn">⚠️ Pengeluaran hari ini melebihi estimasi</p>
        )}
      </div>

      <div className="page__content" style={{ marginTop: 14 }}>

        {/* ── Pocket tiles ── */}
        <div className="pocket-row">
          {[
            { label: 'Tabungan', val: tp?.balance || 0, color: '#34d399', to: '/tabungan' },
            { label: 'Wishlist',  val: wp?.balance || 0, color: '#a78bfa', to: '/wishlist' },
            { label: 'Hari ini', val: todayOut, color: '#fb923c', to: '/transaksi', neg: true },
          ].map(({ label, val, color, to, neg }) => (
            <Link key={label} to={to} className="pocket-tile">
              <div className="pocket-tile__dot" style={{ background: color }} />
              <p className="pocket-tile__label">{label}</p>
              <p className="pocket-tile__val" style={{ color: neg && val > 0 ? 'var(--red)' : 'inherit' }}>
                {neg && val > 0 ? '-' : ''}{formatRupiah(val)}
              </p>
            </Link>
          ))}
        </div>

        {/* ── Grafik minggu ini ── */}
        <div className="card">
          <p className="s-label">Pengeluaran minggu ini</p>
          <div className="week-chart">
            {weeklyData.map((d, i) => {
              const isToday = d.ds === todayStr
              const height  = (d.total / maxW) * 100
              return (
                <div key={i} className={`wc-col ${isToday ? 'wc-col--today' : ''}`}>
                  {d.total > 0 && <span className="wc-val">{formatRupiah(d.total, true)}</span>}
                  <div className="wc-bar" style={{ height: `${Math.max(height, d.total > 0 ? 6 : 0)}%` }} />
                  <span className="wc-lbl">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Wishlist teratas ── */}
        {topWL && (
          <Link to="/wishlist" className="card" style={{ display: 'block' }}>
            <p className="s-label">Wishlist teratas</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ fontWeight: 700, fontSize: '0.95rem' }}>{topWL.name}</p>
              <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--violet)' }}>
                {Math.round((topWL.saved_amount / topWL.price) * 100)}%
              </p>
            </div>
            <div className="prog-track">
              <div className="prog-fill" style={{ width: `${Math.min((topWL.saved_amount / topWL.price) * 100, 100)}%` }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--t3)', marginTop: 8 }}>
              <span>{formatRupiah(topWL.saved_amount)} terkumpul</span>
              <span>kurang <span className="red fw7">{formatRupiah(topWL.price - topWL.saved_amount)}</span></span>
            </div>
          </Link>
        )}

        {/* ── Empty state ── */}
        {transactions.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">💸</div>
            <p>Belum ada catatan</p>
            <p className="t3">Catat pemasukan dulu yuk!</p>
            <Link to="/transaksi" className="btn btn--primary mt8">Catat sekarang</Link>
          </div>
        )}

      </div>
    </div>
  )
}
