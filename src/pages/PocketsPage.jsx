import { useState, useMemo } from 'react'
import { usePockets } from '../hooks/usePockets'
import { useTransactions } from '../hooks/useTransactions'
import { useProfile } from '../hooks/useProfile'
import { useWishlist } from '../hooks/useWishlist'
import { useToast } from '../components/Toast'
import Mascot from '../components/Mascot'
import { formatRupiah, isWfhDay, getWeekDates } from '../lib/utils'

export default function PocketsPage() {
  const { updatePocketBalance, transferBetweenPockets, getPocketByName } = usePockets()
  const { transactions } = useTransactions()
  const { profile } = useProfile()
  const { wishlist } = useWishlist()
  const toast = useToast()

  const [editP, setEditP]   = useState(null)
  const [editAmt, setEditAmt] = useState('')
  const [busy, setBusy]     = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [tr, setTr]         = useState({ from:'jajan', to:'tabungan', amount:'' })
  const [showPrev, setShowPrev] = useState(false)
  const [prev, setPrev]     = useState({ tabungan:'', wishlist:'' })

  const today    = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekDates = getWeekDates(today)
  const weekStart = weekDates[0].toISOString().split('T')[0]
  const weekEnd   = weekDates[6].toISOString().split('T')[0]

  const jp = getPocketByName('jajan')
  const tp = getPocketByName('tabungan')
  const wp = getPocketByName('wishlist')

  // Kebutuhan rutin minggu ini
  const needs = useMemo(() => {
    if (!profile) return { transport:0, makan:0, total:0, days:[] }
    const { transport_amount:ta=14000, lunch_amount:la=15000, dinner_amount:da=20000, wfh_days:wfhd=[3] } = profile
    const workDays = weekDates.filter((d)=>d.getDay()>=1&&d.getDay()<=5)
    const days = workDays.map((d) => {
      const ds  = d.toISOString().split('T')[0]
      const wfh = isWfhDay(d, wfhd)
      const tr  = wfh ? 0 : ta
      const mk  = la + da
      return {
        label: ['Min','Sen','Sel','Rab','Kam','Jum','Sab'][d.getDay()],
        dateStr:ds, transport:tr, makan:mk, total:tr+mk,
        isWfh:wfh, isPast:ds<todayStr, isToday:ds===todayStr,
      }
    })
    return {
      transport: days.reduce((s,d)=>s+d.transport,0),
      makan:     days.reduce((s,d)=>s+d.makan,0),
      total:     days.reduce((s,d)=>s+d.total,0),
      days,
    }
  }, [profile, weekDates, todayStr])

  // Aktual minggu ini
  const actual = useMemo(() => {
    const exp = transactions.filter((t)=>t.type==='expense'&&t.date>=weekStart&&t.date<=weekEnd)
    return {
      total:     exp.reduce((s,t)=>s+t.amount,0),
      transport: exp.filter((t)=>t.category==='transport').reduce((s,t)=>s+t.amount,0),
      makan:     exp.filter((t)=>['makan_siang','makan_malam'].includes(t.category)).reduce((s,t)=>s+t.amount,0),
      jajan:     exp.filter((t)=>!['transport','makan_siang','makan_malam'].includes(t.category)).reduce((s,t)=>s+t.amount,0),
    }
  }, [transactions, weekStart, weekEnd])

  // Kalkulator
  const jajanBal     = jp?.balance || 0
  const savingPct    = profile?.saving_percent || 20
  const sisaKebutuhan = Math.max(0, needs.total - actual.total)
  const tersedia      = Math.max(0, jajanBal - sisaKebutuhan)
  const estNabung     = Math.round(tersedia * savingPct / 100)
  const uangBebas     = Math.max(0, tersedia - estNabung)

  const mood = actual.jajan > uangBebas * 1.2 ? 'sad'
             : estNabung > 0 ? 'happy' : 'neutral'

  // Wishlist
  const activeWL = wishlist.filter((w)=>!w.is_completed).sort((a,b)=>a.priority-b.priority)
  const totalKurang = activeWL.reduce((s,w)=>s+Math.max(0,w.price-w.saved_amount),0)

  // Handlers
  async function saveEditPocket(p) {
    const v = parseInt(editAmt)
    if (isNaN(v) || v < 0) return
    setBusy(true)
    const { error } = await updatePocketBalance(p.id, v)
    setBusy(false)
    if (error) { toast('Gagal update 😢','error'); return }
    toast('Saldo diperbarui ✅','success')
    setEditP(null); setEditAmt('')
  }

  async function submitTransfer(e) {
    e.preventDefault()
    const amt = parseInt(tr.amount)
    if (!amt || tr.from===tr.to) return
    const pm = { jajan:jp, tabungan:tp, wishlist:wp }
    const fp = pm[tr.from], top = pm[tr.to]
    if (!fp||!top) return
    setBusy(true)
    const { error } = await transferBetweenPockets(fp.id, top.id, amt)
    setBusy(false)
    if (error) { toast(error,'error'); return }
    toast(`${formatRupiah(amt)} dipindah ✅`,'success')
    setTr(t=>({...t,amount:''})); setShowTransfer(false)
  }

  async function sisihkanNabung() {
    if (!jp||!tp||estNabung<=0) return
    setBusy(true)
    const { error } = await transferBetweenPockets(jp.id, tp.id, estNabung)
    setBusy(false)
    if (error) { toast(error,'error'); return }
    toast(`${formatRupiah(estNabung)} disisihkan ke Tabungan 🐷`,'success')
  }

  async function savePrev() {
    const tabAmt  = parseInt(prev.tabungan) || 0
    const wishAmt = parseInt(prev.wishlist)  || 0
    if (!tabAmt && !wishAmt) return
    setBusy(true)
    if (tabAmt  && tp) await updatePocketBalance(tp.id, tp.balance + tabAmt)
    if (wishAmt && wp) await updatePocketBalance(wp.id, wp.balance + wishAmt)
    setBusy(false)
    toast('Tabungan lama tersimpan ✅','success')
    setShowPrev(false); setPrev({tabungan:'',wishlist:''})
  }

  const PM = [
    { key:'jajan',    icon:'🍜', label:'Uang Jajan',       c:'peach',    p:jp },
    { key:'tabungan', icon:'🏦', label:'Tabungan',          c:'mint',     p:tp },
    { key:'wishlist', icon:'✨', label:'Tabungan Wishlist', c:'lavender', p:wp },
  ]

  const PO = [
    {value:'jajan',label:'🍜 Uang Jajan'},
    {value:'tabungan',label:'🏦 Tabungan'},
    {value:'wishlist',label:'✨ Wishlist'},
  ]

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Nabung 🐷</h1>
      </div>

      <div className="page__content">

        {/* ── Pos Uang ── */}
        <div className="pocket-cards-row">
          {PM.map(({key,icon,label,c,p})=>(
            <div key={key} className={`pocket-card-sm pocket-card-sm--${c}`}>
              <span className="pocket-card-sm__icon">{icon}</span>
              <span className="pocket-card-sm__label">{label}</span>
              {editP===p?.id ? (
                <div className="pocket-edit-inline">
                  <input type="number" className="form-input form-input--sm" value={editAmt}
                    onChange={(e)=>setEditAmt(e.target.value)} placeholder="Saldo" inputMode="numeric" autoFocus />
                  <div style={{display:'flex',gap:'4px',marginTop:'4px'}}>
                    <button className="btn btn--primary btn--xs" disabled={busy} onClick={()=>saveEditPocket(p)}>✓</button>
                    <button className="btn btn--ghost btn--xs" onClick={()=>{setEditP(null);setEditAmt('')}}>✕</button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="pocket-card-sm__amount">{formatRupiah(p?.balance||0)}</span>
                  <button className="pocket-card-sm__edit"
                    onClick={()=>{setEditP(p?.id);setEditAmt(String(p?.balance||0))}}>✏️ edit</button>
                </>
              )}
            </div>
          ))}
        </div>

        {/* ── Input Tabungan Minggu Lalu ── */}
        <div className="card card--yellow">
          <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between'}}>
            <div>
              <p className="card-hint__title">📦 Ada tabungan dari minggu lalu?</p>
              <p className="card-hint__sub">Masukkan saldo awal sebelum mulai minggu ini</p>
            </div>
            <button className="btn btn--ghost btn--sm" onClick={()=>setShowPrev(!showPrev)}>
              {showPrev?'Tutup':'Isi'}
            </button>
          </div>
          {showPrev && (
            <div style={{marginTop:'12px'}}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tambah ke Tabungan</label>
                  <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                    value={prev.tabungan} onChange={(e)=>setPrev(p=>({...p,tabungan:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Tambah ke Tab. Wishlist</label>
                  <input type="number" className="form-input" placeholder="0" inputMode="numeric"
                    value={prev.wishlist} onChange={(e)=>setPrev(p=>({...p,wishlist:e.target.value}))} />
                </div>
              </div>
              <button className="btn btn--primary btn--full" disabled={busy} onClick={savePrev}>
                {busy?'Menyimpan...':'💾 Simpan'}
              </button>
            </div>
          )}
        </div>

        {/* ── Kalkulator Uang ── */}
        <div className="card money-calc">
          <div className="money-calc__header">
            <Mascot mood={mood} size={44} />
            <div>
              <p className="money-calc__title">Uangmu minggu ini</p>
              <p className="money-calc__sub">Breakdown buat bantu keputusanmu 🔍</p>
            </div>
          </div>

          <div className="money-calc__body">
            <MRow icon="💰" label="Saldo uang jajan" val={jajanBal} />
            <MRow icon="🚌🍱" label={`Sisa kebutuhan rutin`} val={-sisaKebutuhan} isNeg
              sub={`Total rencana ${formatRupiah(needs.total,true)} · sudah keluar ${formatRupiah(actual.total,true)}`} />
            <div className="money-calc__divider"/>
            <MRow icon="✅" label="Tersedia setelah kebutuhan" val={tersedia} hl />
            <MRow icon="🐷" label={`Estimasi nabung (${savingPct}%)`} val={-estNabung} isNeg />
            <div className="money-calc__divider"/>
            <MRow icon="🎉" label="Uang bebas (main/jajan)" val={uangBebas} free big
              warn={actual.jajan>uangBebas?`Sudah jajan ${formatRupiah(actual.jajan,true)}, melebihi anggaran!`:null} />
          </div>

          {estNabung > 0 && jp && tp && (
            <button className="btn btn--primary btn--full" style={{marginTop:'14px'}}
              disabled={busy} onClick={sisihkanNabung}>
              🐷 Sisihkan {formatRupiah(estNabung)} ke Tabungan
            </button>
          )}
        </div>

        {/* ── Tracking Harian ── */}
        <div className="card">
          <p className="section__title" style={{marginBottom:'10px'}}>Tracking Harian 📅</p>
          <div className="day-table">
            <div className="day-table__header">
              <span>Hari</span><span>Trans.</span><span>Makan</span><span>Total</span>
            </div>
            {needs.days.map((d)=>{
              const dt  = transactions.filter((t)=>t.type==='expense'&&t.date===d.dateStr)
              const dtr = dt.filter((t)=>t.category==='transport').reduce((s,t)=>s+t.amount,0)
              const dmk = dt.filter((t)=>['makan_siang','makan_malam'].includes(t.category)).reduce((s,t)=>s+t.amount,0)
              const dtot= dt.reduce((s,t)=>s+t.amount,0)
              const over= d.isPast&&dtot>d.total
              return (
                <div key={d.dateStr}
                  className={`day-table__row ${d.isToday?'day-table__row--today':''} ${d.isPast?'day-table__row--past':''}`}>
                  <span className="day-table__day">
                    {d.label}
                    {d.isWfh   && <span className="badge-sm badge-sm--wfh">WFH</span>}
                    {d.isToday && <span className="badge-sm badge-sm--today">hari ini</span>}
                  </span>
                  <span className={dtr>d.transport&&d.transport>0?'text-over':''}>
                    {dtr>0 ? formatRupiah(dtr,true) : <span className="text-plan">{d.isWfh?'-':formatRupiah(d.transport,true)}</span>}
                  </span>
                  <span className={dmk>d.makan?'text-over':''}>
                    {dmk>0 ? formatRupiah(dmk,true) : <span className="text-plan">{formatRupiah(d.makan,true)}</span>}
                  </span>
                  <span className={over?'text-over fw-bold':'fw-bold'}>
                    {dtot>0 ? formatRupiah(dtot,true) : <span className="text-plan">{formatRupiah(d.total,true)}</span>}
                  </span>
                </div>
              )
            })}
            <div className="day-table__row day-table__row--total">
              <span>Total</span>
              <span>{formatRupiah(actual.transport,true)}<span className="text-plan"> /{formatRupiah(needs.transport,true)}</span></span>
              <span>{formatRupiah(actual.makan,true)}<span className="text-plan"> /{formatRupiah(needs.makan,true)}</span></span>
              <span className={actual.total>needs.total?'text-over fw-bold':'fw-bold'}>
                {formatRupiah(actual.total,true)}<span className="text-plan"> /{formatRupiah(needs.total,true)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Wishlist Progress ── */}
        {activeWL.length > 0 && (
          <div className="card">
            <p className="section__title" style={{marginBottom:'10px'}}>Progress Wishlist ✨</p>
            {activeWL.map((item)=>{
              const kurang   = Math.max(0, item.price-item.saved_amount)
              const pct      = Math.min((item.saved_amount/item.price)*100,100)
              const weeksEst = estNabung>0&&kurang>0 ? Math.ceil(kurang/estNabung) : null
              return (
                <div key={item.id} className="wishlist-mini">
                  <div className="wishlist-mini__row">
                    <span className="wishlist-mini__name">
                      <span className="wishlist-mini__pri">#{item.priority}</span>{item.name}
                    </span>
                    <span className="wishlist-mini__pct">{Math.round(pct)}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-bar__fill progress-bar__fill--wishlist" style={{width:`${pct}%`}} />
                  </div>
                  <div className="wishlist-mini__info">
                    <span>{formatRupiah(item.saved_amount)} / {formatRupiah(item.price)}</span>
                    {kurang>0
                      ? <span className="wishlist-mini__kurang">
                          kurang {formatRupiah(kurang,true)}
                          {weeksEst && <span className="text-plan"> · ~{weeksEst} mgg</span>}
                        </span>
                      : <span style={{color:'var(--mint-dark)',fontWeight:700}}>✅ Cukup!</span>}
                  </div>
                </div>
              )
            })}
            {totalKurang > 0 && (
              <div className="wishlist-total-hint">
                <span>Total kurang semua wishlist</span>
                <strong>{formatRupiah(totalKurang)}</strong>
              </div>
            )}
          </div>
        )}

        {/* ── Pindah Uang ── */}
        <div>
          <button className="btn btn--ghost btn--full" onClick={()=>setShowTransfer(!showTransfer)}>
            {showTransfer?'✕ Tutup':'↔ Pindah uang antar pos'}
          </button>
          {showTransfer && (
            <form className="card" style={{marginTop:'8px'}} onSubmit={submitTransfer}>
              <div className="transfer-row">
                <select className="form-select" value={tr.from} onChange={(e)=>setTr(t=>({...t,from:e.target.value}))}>
                  {PO.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <span className="transfer-arrow">→</span>
                <select className="form-select" value={tr.to} onChange={(e)=>setTr(t=>({...t,to:e.target.value}))}>
                  {PO.map((o)=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <input type="number" className="form-input" placeholder="Nominal (Rp)"
                  value={tr.amount} onChange={(e)=>setTr(t=>({...t,amount:e.target.value}))}
                  inputMode="numeric" min="1" required />
              </div>
              <button type="submit" className="btn btn--primary btn--full"
                disabled={busy||tr.from===tr.to||!tr.amount}>💸 Pindahkan</button>
            </form>
          )}
        </div>

      </div>
    </div>
  )
}

function MRow({icon,label,val,sub,warn,isNeg,hl,free,big}) {
  return (
    <div className={`money-row ${hl?'money-row--hl':''} ${free?'money-row--free':''}`}>
      <div className="money-row__left">
        <span className="money-row__icon">{icon}</span>
        <div>
          <span className="money-row__label">{label}</span>
          {sub  && <span className="money-row__sub">{sub}</span>}
          {warn && <span className="money-row__warn">⚠️ {warn}</span>}
        </div>
      </div>
      <span className={`money-row__val ${big?'money-row__val--big':''} ${isNeg?'money-row__val--neg':''} ${(hl||free)&&val>0?'money-row__val--pos':''}`}>
        {isNeg?'-':''}{formatRupiah(Math.abs(val))}
      </span>
    </div>
  )
}
