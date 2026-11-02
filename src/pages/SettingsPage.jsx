import { useState, useEffect } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { formatRupiah } from '../lib/utils'

const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

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

  function toggleWfh(d) {
    setForm((f) => ({
      ...f,
      wfh_days: f.wfh_days.includes(d) ? f.wfh_days.filter((x) => x !== d) : [...f.wfh_days, d],
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
    else toast('Tersimpan ✓', 'success')
  }

  const estWeekly = (() => {
    const ta  = parseInt(form.transport_amount) || 0
    const la  = parseInt(form.lunch_amount)     || 0
    const da  = parseInt(form.dinner_amount)    || 0
    const wfh = form.wfh_days.filter((d) => d >= 1 && d <= 5).length
    return ta * (5 - wfh) + (la + da) * 5
  })()

  return (
    <div className="page">
      <div className="page__header">
        <h1 className="page__title">Pengaturan</h1>
      </div>

      <div className="page__content">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Pengeluaran rutin */}
          <div className="card">
            <p className="s-title" style={{ marginBottom: 16 }}>Pengeluaran Rutin Harian</p>

            <div className="form-group">
              <label className="form-label">🚌 Transport pulang-pergi (Rp)</label>
              <input type="number" className="form-input" inputMode="numeric" min="0"
                value={form.transport_amount}
                onChange={(e) => setForm((f) => ({ ...f, transport_amount: e.target.value }))} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">🍱 Makan siang (Rp)</label>
                <input type="number" className="form-input" inputMode="numeric" min="0"
                  value={form.lunch_amount}
                  onChange={(e) => setForm((f) => ({ ...f, lunch_amount: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">🍜 Makan malam (Rp)</label>
                <input type="number" className="form-input" inputMode="numeric" min="0"
                  value={form.dinner_amount}
                  onChange={(e) => setForm((f) => ({ ...f, dinner_amount: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <p className="form-label">🏠 Hari WFH — tidak ada transport</p>
              <div className="day-toggle-group">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button key={d} type="button"
                    className={`day-toggle ${form.wfh_days.includes(d) ? 'day-toggle--active' : ''}`}
                    onClick={() => toggleWfh(d)} aria-pressed={form.wfh_days.includes(d)}>
                    {DAYS[d]}
                  </button>
                ))}
              </div>
            </div>

            <div style={{
              background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.22)',
              borderRadius: 'var(--r1)', padding: '10px 12px', fontSize: '0.82rem',
            }}>
              <span className="t2">Estimasi mingguan: </span>
              <span className="grn fw7">{formatRupiah(estWeekly)}</span>
              <span className="t3"> (transport {5 - form.wfh_days.filter((d) => d >= 1 && d <= 5).length} hari + makan 5 hari)</span>
            </div>
          </div>

          {/* Target nabung */}
          <div className="card">
            <p className="s-title" style={{ marginBottom: 16 }}>Target Nabung</p>
            <div className="form-group">
              <label className="form-label">🐷 Persentase dari uang jajan — {form.saving_percent}%</label>
              <input type="range" min="5" max="50" step="5"
                value={form.saving_percent}
                onChange={(e) => setForm((f) => ({ ...f, saving_percent: Number(e.target.value) }))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--t3)', marginTop: 3 }}>
                <span>5%</span><span>50%</span>
              </div>
            </div>
          </div>

          <button type="submit" className="btn btn--primary btn--full" disabled={busy}>
            {busy ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>

        </form>

        <p style={{ textAlign: 'center', fontSize: '0.68rem', color: 'var(--t3)', marginTop: 8 }}>
          duit.ku v0.2.0
        </p>
      </div>
    </div>
  )
}
