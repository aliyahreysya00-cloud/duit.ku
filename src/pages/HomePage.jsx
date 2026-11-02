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

  const todayExpense = useMemo(() =>
    transactions.filter((t) => t.type === 'expense' && t.date === todayStr).reduce((s,t)=>s+t.amount,0),
    [transactions, todayStr])

  const todayIncome = useMemo(() =>
    transactions.filter((t) => t.type === 'income' && t.date === todayStr).reduce((s,t)=>s+t.amount,0),
    [transactions, todayStr])

  const dailyNeed = useMemo(() => {
    if (!profile) return 0
    const tr = isWFH ? 0 : (profile.transport_amount || 14000)
    return tr + (profile.lunch_amount || 15000) + (profile.dinner_amount || 20000)
  }, [profile, isWFH])

  // Grafik minggu
  const weekDates  = getWeekDates(today)
  const weeklyData = useMemo(() =>
    weekDates.map((d) => {
      const ds    = d.toISOString().split('T')[0]
      const total = transactions.filter((t) => t.type === 'expense' && t.date === ds).reduce((s,t)=>s+t.amount,0)
      return { ds, total, label: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()] }
    }), [transactions, weekDates])
  const maxW = Math.max(...weeklyData.map((d) => d.total), 1)

  const mood = useMemo(() => {
    if (todayExpense === 0) return 'neutral'
    if (todayExpense > dailyNeed * 1.4) return 'sad'
    if (todayExpense <= dailyNeed * 0.6) return 'happy'
    return 'neutral'
  }, [todayExpense, dailyNeed])

  const topWishlist = wishlist.filter((w) => !w.is_completed).sort((a,b)=>a.priority-b.priority)[0]

  return (
    <div className="page">

      {/* Header */}
      <div className="home-header">
        <div className="home-header__left">
          <h1>
            {getGreeting()} 👋
          </h1>
          <p className="home-header__date">
            {today.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'})}
            {isWFH && <span className="badge-wfh">WFH</span>}
          </p>
        </div>
        <Mascot mood={mood} size={52} />
      </div>

      {/* Hero card */}
      <div className="hero-card">
        <div className="hero-card__top">
          <div>
            <p className="hero-card__label">Sisa uang jajan</p>
            <p className="hero-card__amount">{formatRupiah(jajanPocket?.balance || 0)}</p>
          </div>
          <Link to="/transaksi" className="btn btn--white btn--sm">+ Catat</Link>
        </div>
        <div className="hero-card__stats">
          <div className="hero-stat">
            <p className="hero-stat__label">Keluar hari ini</p>
            <p className="hero-stat__val">{formatRupiah(todayExpense)}</p>
          </div>
          <div className="hero-stat">
            <p className="hero-stat__label">Estimasi harian</p>
            <p className="hero-stat__val">{formatRupiah(dailyNeed)}</p>
          </div>
          <div className="hero-stat">
            <p className="hero-stat__label">Masuk hari ini</p>
            <p className="hero-stat__val">+{formatRupiah(todayIncome)}</p>
          </div>
        </div>
        {todayExpense > dailyNeed && (
          <p className="hero-card__warn">⚠️ Pengeluaran melewati estimasi harian!</p>
        )}
      </div>

      {/* Pocket grid */}
      <div className="pocket-grid" style={{ marginTop:'12px' }}>
        {[
          { icon:'🍜', label:'Uang Jajan', val: jajanPocket?.balance||0, cls:'peach', to:'/tabungan' },
          { icon:'🏦', label:'Tabungan',   val: tabunganPocket?.balance||0, cls:'mint',  to:'/tabungan' },
          { icon:'✨', label:'Wishlist',   val: wishlistPocket?.balance||0, cls:'lav',   to:'/wishlist' },
        ].map(({ icon, label, val, cls, to }) => (
          <Link key={label} to={to} className={`pocket-tile pocket-tile--${cls}`}>
            <span className="pocket-tile__icon">{icon}</span>
            <span className="pocket-tile__label">{label}</span>
            <span className="pocket-tile__val">{formatRupiah(val)}</span>
          </Link>
        ))}
      </div>

      <div className="page__content" style={{ paddingTop:'12px' }}>

        {/* Grafik minggu ini */}
        <div className="card">
          <p className="section-title" style={{marginBottom:'2px'}}>Pengeluaran minggu ini 📊</p>
          <div className="week-chart">
            {weeklyData.map((d,i) => {
              const isToday = d.ds === todayStr
              const h = (d.total / maxW) * 100
              return (
                <div key={i} className={`week-chart__col ${isToday?'week-chart__col--today':''}`}>
                  {d.total > 0 && <span className="week-chart__val">{formatRupiah(d.total,true)}</span>}
                  <div className="week-chart__bar" style={{height:`${Math.max(h,d.total>0?6:0)}%`}} />
                  <span className="week-chart__label">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Wishlist teratas */}
        {topWishlist && (
          <Link to="/wishlist" className="wishlist-snap">
            <p className="wishlist-snap__label">Wishlist teratas ✨</p>
            <div className="wishlist-snap__row">
              <span className="wishlist-snap__name">{topWishlist.name}</span>
              <span className="wishlist-snap__pct">{Math.round((topWishlist.saved_amount/topWishlist.price)*100)}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar__fill progress-bar__fill--wishlist"
                style={{width:`${Math.min((topWishlist.saved_amount/topWishlist.price)*100,100)}%`}} />
            </div>
            <p className="wishlist-snap__sub">
              {formatRupiah(topWishlist.saved_amount)} terkumpul dari {formatRupiah(topWishlist.price)}
              {' · kurang '}<strong>{formatRupiah(topWishlist.price-topWishlist.saved_amount)}</strong>
            </p>
          </Link>
        )}

        {/* Empty state */}
        {transactions.length === 0 && (
          <div className="empty-state">
            <span className="empty-state__emoji">🥚</span>
            <p>Belum ada catatan nih~</p>
            <p>Yuk mulai catat keuanganmu!</p>
            <Link to="/transaksi" className="btn btn--primary mt-sm">+ Catat sekarang</Link>
          </div>
        )}

      </div>
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 11) return 'Pagi!'
  if (h < 15) return 'Siang!'
  if (h < 18) return 'Sore!'
  return 'Malam!'
}
