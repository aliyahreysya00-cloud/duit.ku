import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Mascot from '../components/Mascot'
import { useTransactions } from '../hooks/useTransactions'
import { usePockets } from '../hooks/usePockets'
import { useWishlist } from '../hooks/useWishlist'
import { useProfile } from '../hooks/useProfile'
import { formatRupiah, getWeekDates, getDayOfWeek, isWfhDay } from '../lib/utils'

export default function HomePage() {
  const { transactions } = useTransactions()
  const { pockets, getPocketByName } = usePockets()
  const { wishlist } = useWishlist()
  const { profile } = useProfile()

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const isWFH = profile ? isWfhDay(today, profile.wfh_days) : false

  // Pengeluaran hari ini
  const todayExpenses = useMemo(() =>
    transactions.filter((t) => t.type === 'expense' && t.date === todayStr)
      .reduce((sum, t) => sum + t.amount, 0),
    [transactions, todayStr]
  )

  // Pengeluaran minggu ini per hari (untuk grafik)
  const weekDates = getWeekDates(today)
  const weeklyData = useMemo(() => {
    return weekDates.map((d) => {
      const dateStr = d.toISOString().split('T')[0]
      const total = transactions
        .filter((t) => t.type === 'expense' && t.date === dateStr)
        .reduce((sum, t) => sum + t.amount, 0)
      return { date: d, dateStr, total, label: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()] }
    })
  }, [transactions, weekDates])

  const maxWeekly = Math.max(...weeklyData.map((d) => d.total), 1)

  // Pos uang
  const jajanPocket = getPocketByName('jajan')
  const tabunganPocket = getPocketByName('tabungan')

  // Sisa jajan hari ini (estimasi)
  const dailyExpected = useMemo(() => {
    if (!profile) return 0
    const transport = isWFH ? 0 : (profile.transport_amount || 14000)
    const meals = (profile.lunch_amount || 15000) + (profile.dinner_amount || 15000)
    return transport + meals
  }, [profile, isWFH])

  const sisaJajan = (jajanPocket?.balance || 0) - todayExpenses

  // Mood maskot
  const mood = useMemo(() => {
    if (todayExpenses === 0) return 'neutral'
    if (todayExpenses > dailyExpected * 1.5) return 'sad'
    if (todayExpenses <= dailyExpected * 0.8) return 'happy'
    return 'neutral'
  }, [todayExpenses, dailyExpected])

  // Wishlist prioritas tertinggi
  const topWishlist = wishlist
    .filter((w) => !w.is_completed)
    .sort((a, b) => a.priority - b.priority)[0]

  return (
    <div className="page">
      <header className="page__header">
        <div className="home-header">
          <div>
            <h1 className="home-header__greeting">
              Halo! 👋
            </h1>
            <p className="home-header__date">
              {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              {isWFH && <span className="badge badge--wfh"> WFH</span>}
            </p>
          </div>
          <Mascot mood={mood} size={60} />
        </div>
      </header>

      <main className="page__content">
        {/* Kartu saldo utama */}
        <section className="card card--primary" aria-label="Sisa uang jajan">
          <p className="card__label">Sisa uang jajan kamu</p>
          <p className="card__amount">{formatRupiah(jajanPocket?.balance || 0)}</p>
          <p className="card__sub">
            Pengeluaran hari ini: <strong>{formatRupiah(todayExpenses)}</strong>
            {' · '}Estimasi harian: <strong>{formatRupiah(dailyExpected)}</strong>
          </p>
          <Link to="/transaksi" className="btn btn--white btn--sm" style={{ marginTop: '0.75rem' }}>
            + Catat pengeluaran
          </Link>
        </section>

        {/* Pos uang */}
        <section className="section">
          <h2 className="section__title">Pos uangmu 🐷</h2>
          <div className="pocket-grid">
            {[
              { name: 'jajan', icon: '🍜', label: 'Uang Jajan', pocket: jajanPocket },
              { name: 'tabungan', icon: '🏦', label: 'Tabungan', pocket: tabunganPocket },
              { name: 'wishlist', icon: '✨', label: 'Tabungan Wishlist', pocket: getPocketByName('wishlist') },
            ].map(({ icon, label, pocket }) => (
              <div key={label} className="pocket-mini-card">
                <span className="pocket-mini-card__icon">{icon}</span>
                <span className="pocket-mini-card__label">{label}</span>
                <span className="pocket-mini-card__amount">{formatRupiah(pocket?.balance || 0)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Grafik pengeluaran minggu ini */}
        <section className="section">
          <h2 className="section__title">Minggu ini 📊</h2>
          <div className="week-chart" aria-label="Grafik pengeluaran minggu ini">
            {weeklyData.map((d, i) => {
              const isToday = d.dateStr === todayStr
              const heightPct = maxWeekly > 0 ? (d.total / maxWeekly) * 100 : 0
              return (
                <div key={i} className={`week-chart__bar-wrap ${isToday ? 'week-chart__bar-wrap--today' : ''}`}>
                  <span className="week-chart__amount">
                    {d.total > 0 ? formatRupiah(d.total, true) : ''}
                  </span>
                  <div
                    className="week-chart__bar"
                    style={{ height: `${Math.max(heightPct, d.total > 0 ? 8 : 0)}%` }}
                    role="img"
                    aria-label={`${d.label}: ${formatRupiah(d.total)}`}
                  />
                  <span className="week-chart__label">{d.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Wishlist teratas */}
        {topWishlist && (
          <section className="section">
            <h2 className="section__title">Wishlist teratas ✨</h2>
            <Link to="/wishlist" className="wishlist-preview-card">
              <div className="wishlist-preview-card__info">
                <strong>{topWishlist.name}</strong>
                <span>{formatRupiah(topWishlist.saved_amount)} / {formatRupiah(topWishlist.price)}</span>
              </div>
              <div className="progress-bar" aria-label={`Progress ${topWishlist.name}`}>
                <div
                  className="progress-bar__fill"
                  style={{ width: `${Math.min((topWishlist.saved_amount / topWishlist.price) * 100, 100)}%` }}
                />
              </div>
              <span className="wishlist-preview-card__pct">
                {Math.round((topWishlist.saved_amount / topWishlist.price) * 100)}%
              </span>
            </Link>
          </section>
        )}

        {/* Empty state kalau belum ada transaksi */}
        {transactions.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__emoji">🥚</span>
            <p>Belum ada catatan nih~</p>
            <p className="text-muted">Yuk mulai catat pengeluaranmu!</p>
            <Link to="/transaksi" className="btn btn--primary" style={{ marginTop: '1rem' }}>
              Catat sekarang
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
