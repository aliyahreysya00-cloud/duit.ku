import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Mascot from '../components/Mascot'
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

  const jajanPocket    = getPocketByName('jajan')
  const tabunganPocket = getPocketByName('tabungan')
  const wishlistPocket = getPocketByName('wishlist')

  // Pengeluaran hari ini
  const todayExpense = useMemo(() =>
    transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s, t) => s + t.amount, 0),
    [transactions, todayStr])

  // Kebutuhan harian
  const dailyNeed = useMemo(() => {
    if (!profile) return 0
    const transport = isWFH ? 0 : (profile.transport_amount || 14000)
    return transport + (profile.lunch_amount || 15000) + (profile.dinner_amount || 20000)
  }, [profile, isWFH])

  // Grafik minggu ini
  const weekDates  = getWeekDates(today)
  const weeklyData = useMemo(() =>
    weekDates.map((d) => {
      const dateStr = d.toISOString().split('T')[0]
      const total   = transactions.filter((t) => t.type === 'expense' && t.date === dateStr).reduce((s, t) => s + t.amount, 0)
      return { dateStr, total, label: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()] }
    }),
    [transactions, weekDates])
  const maxWeekly = Math.max(...weeklyData.map((d) => d.total), 1)

  // Mood
  const mood = useMemo(() => {
    if (todayExpense === 0) return 'neutral'
    if (todayExpense > dailyNeed * 1.5) return 'sad'
    if (todayExpense <= dailyNeed * 0.7) return 'happy'
    return 'neutral'
  }, [todayExpense, dailyNeed])

  // Wishlist teratas
  const topWishlist = wishlist.filter((w) => !w.is_completed).sort((a, b) => a.priority - b.priority)[0]

  // Sisa untuk jajan hari ini (setelah kebutuhan rutin)
  const sisaJajan = Math.max(0, (jajanPocket?.balance || 0) - todayExpense)

  return (
    <div className="page">
      <header className="page__header">
        <div className="home-header">
          <div>
            <h1 className="home-header__title">Halo! 👋</h1>
            <p className="home-header__date">
              {today.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}
              {isWFH && <span className="badge-wfh" style={{ marginLeft: '0.4rem' }}>WFH</span>}
            </p>
          </div>
          <Mascot mood={mood} size={52} />
        </div>
      </header>

      <main className="page__content">

        {/* Kartu utama */}
        <div className="hero-card">
          <div className="hero-card__row">
            <div>
              <p className="hero-card__label">Sisa uang jajan</p>
              <p className="hero-card__amount">{formatRupiah(jajanPocket?.balance || 0)}</p>
            </div>
            <Link to="/transaksi" className="btn btn--white btn--sm">+ Catat</Link>
          </div>
          <div className="hero-card__sub">
            <span>Keluar hari ini: <strong>{formatRupiah(todayExpense)}</strong></span>
            <span>Estimasi: <strong>{formatRupiah(dailyNeed)}</strong></span>
          </div>
          {todayExpense > dailyNeed && (
            <p className="hero-card__warn">⚠️ Pengeluaran hari ini melebihi estimasi harian!</p>
          )}
        </div>

        {/* Pos uang — 3 kolom compact */}
        <div className="pocket-row">
          {[
            { icon: '🍜', label: 'Jajan',    pocket: jajanPocket },
            { icon: '🏦', label: 'Tabungan', pocket: tabunganPocket },
            { icon: '✨', label: 'Wishlist', pocket: wishlistPocket },
          ].map(({ icon, label, pocket }) => (
            <Link key={label} to="/tabungan" className="pocket-mini">
              <span className="pocket-mini__icon">{icon}</span>
              <span className="pocket-mini__label">{label}</span>
              <span className="pocket-mini__amount">{formatRupiah(pocket?.balance || 0)}</span>
            </Link>
          ))}
        </div>

        {/* Grafik minggu ini */}
        <section className="card">
          <h2 className="card__section-title">Minggu ini 📊</h2>
          <div className="week-chart">
            {weeklyData.map((d, i) => {
              const isToday  = d.dateStr === todayStr
              const heightPct = (d.total / maxWeekly) * 100
              return (
                <div key={i} className={`week-chart__col ${isToday ? 'week-chart__col--today' : ''}`}>
                  {d.total > 0 && (
                    <span className="week-chart__val">{formatRupiah(d.total, true)}</span>
                  )}
                  <div className="week-chart__bar" style={{ height: `${Math.max(heightPct, d.total > 0 ? 6 : 0)}%` }} />
                  <span className="week-chart__label">{d.label}</span>
                </div>
              )
            })}
          </div>
        </section>

        {/* Wishlist teratas */}
        {topWishlist && (
          <Link to="/wishlist" className="card wishlist-snap">
            <div className="wishlist-snap__row">
              <div>
                <p className="wishlist-snap__label">Wishlist teratas ✨</p>
                <p className="wishlist-snap__name">{topWishlist.name}</p>
              </div>
              <span className="wishlist-snap__pct">
                {Math.round((topWishlist.saved_amount / topWishlist.price) * 100)}%
              </span>
            </div>
            <div className="progress-bar" style={{ marginTop: '0.5rem' }}>
              <div className="progress-bar__fill progress-bar__fill--wishlist"
                style={{ width: `${Math.min((topWishlist.saved_amount / topWishlist.price) * 100, 100)}%` }} />
            </div>
            <p className="wishlist-snap__sub">{formatRupiah(topWishlist.saved_amount)} / {formatRupiah(topWishlist.price)}</p>
          </Link>
        )}

        {/* Empty state */}
        {transactions.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__emoji">🥚</span>
            <p>Belum ada catatan nih~</p>
            <p className="text-muted">Yuk mulai catat!</p>
            <Link to="/transaksi" className="btn btn--primary" style={{ marginTop: '1rem' }}>Catat sekarang</Link>
          </div>
        )}

      </main>
    </div>
  )
}
