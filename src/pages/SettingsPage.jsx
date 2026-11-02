import { useState, useEffect } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { formatRupiah } from '../lib/utils'

const DAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function SettingsPage() {
  const { profile, updateProfile } = useProfile()
  const toast = useToast()

  const [form, setForm] = useState({
    transport_amount: '14000',
    lunch_amount:     '15000',
    dinner_amount:    '20000',
    wfh_days:         [3],
    saving_percent:   20,
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) setForm({
      transport_amount: String(profile.transport_amount ?? 14000),
      lunch_amount:     String(profile.lunch_amount     ?? 15000),
      dinner_amount:    String(profile.dinner_amount    ?? 20000),
      wfh_days:         profile.wfh_days    ?? [3],
      saving_percent:   profile.saving_percent ?? 20,
    })
  }, [profile])

  function toggleWfh(day) {
    setForm((f) => ({
      ...f,
      wfh_days: f.wfh_days.includes(day)
        ? f.wfh_days.filter((d) => d !== day)
        : [...f.wfh_days, day],
    }))
  }

  async function handleSave(e) {
    e.preventDefault()
    setBusy(true)
    const { error } = await updateProfile({
      transport_amount: parseInt(form.transport_amount) || 14000,
      lunch_amount:     parseInt(form.lunch_amount)     || 15000,
      dinner_amount:    parseInt(form.dinner_amount)    || 20000,
      wfh_days:         form.wfh_days,
      saving_percent:   parseInt(form.saving_percent)   || 20,
    })
    setBusy(false)
    if (error) toast('Gagal menyimpan', 'error')
    else toast('Pengaturan tersimpan ✓', 'success')
  }

  const estWeekly = (() => {
    const tr  = parseInt(form.transport_amount) || 0
    const lu  = parseInt(form.lunch_amount)     || 0
    const di  = parseInt(form.dinner_amount)    || 0
    const wfh = form.wfh_days.filter((d) => d >= 1 && d <= 5).length
    return tr * (5 - wfh) + (lu + di) * 5
  })()

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Pengaturan</h1>
      </div>

      <div className="page__content">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Pengeluaran rutin */}
          <div className="glass" style={{ padding: 18 }}>
            <p className="s-title" style={{ marginBottom: 14 }}>Pengeluaran Rutin Harian</p>

            <div className="form-group">
              <label className="form-label">🚌 Transport pulang-pergi (Rp)</label>
              <input type="number" className="form-input" inputMode="numeric" min="0"
                value={form.transport_amount}
                onChange={(e) => setForm((f) => ({ ...f, transport_amount: e.target.value }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">🍱 Makan siang</label>
                <input type="number" className="form-input" inputMode="numeric" min="0"
                  value={form.lunch_amount}
                  onChange={(e) => setForm((f) => ({ ...f, lunch_amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">🍜 Makan malam</label>
                <input type="number" className="form-input" inputMode="numeric" min="0"
                  value={form.dinner_amount}
                  onChange={(e) => setForm((f) => ({ ...f, dinner_amount: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <p className="form-label">🏠 Hari WFH (tidak ada transport)</p>
              <div className="day-toggle-group">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button key={d} type="button"
                    className={`day-toggle ${form.wfh_days.includes(d) ? 'day-toggle--active' : ''}`}
                    onClick={() => toggleWfh(d)} aria-pressed={form.wfh_days.includes(d)}>
                    {DAY_LABELS[d]}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimasi */}
            <div style={{ background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', borderRadius: 'var(--r1)', padding: '10px 12px', fontSize: '0.83rem', marginTop: 4 }}>
              <span className="text-dim">Estimasi mingguan: </span>
              <span style={{ fontWeight: 700, color: 'var(--accent-3)' }}>{formatRupiah(estWeekly)}</span>
              <span className="text-muted"> (transport {5 - form.wfh_days.filter((d)=>d>=1&&d<=5).length} hari + makan 5 hari)</span>
            </div>
          </div>

          {/* Target nabung */}
          <div className="glass" style={{ padding: 18 }}>
            <p className="s-title" style={{ marginBottom: 14 }}>Target Nabung</p>
            <div className="form-group">
              <label className="form-label">🐷 Persentase dari uang jajan ({form.saving_percent}%)</label>
              <input type="range" min="5" max="50" step="5"
                value={form.saving_percent}
                onChange={(e) => setForm((f) => ({ ...f, saving_percent: Number(e.target.value) }))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-3)' }}>
                <span>5%</span><span>50%</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-3)', marginTop: 8 }}>
          duit.ku v0.2.0
        </p>
      </div>
    </div>
  )
}
