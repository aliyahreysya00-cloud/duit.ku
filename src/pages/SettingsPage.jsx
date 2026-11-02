import { useState, useEffect } from 'react'
import { useProfile } from '../hooks/useProfile'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { formatRupiah } from '../lib/utils'

const DAY_LABELS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

export default function SettingsPage() {
  const { profile, updateProfile } = useProfile()
  const { user, signOut } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState({
    transport_amount: '',
    lunch_amount: '',
    dinner_amount: '',
    wfh_days: [3],
    saving_percent: 20,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        transport_amount: String(profile.transport_amount ?? 14000),
        lunch_amount: String(profile.lunch_amount ?? 15000),
        dinner_amount: String(profile.dinner_amount ?? 15000),
        wfh_days: profile.wfh_days ?? [3],
        saving_percent: profile.saving_percent ?? 20,
      })
    }
  }, [profile])

  function toggleWfhDay(day) {
    setForm((f) => {
      const days = f.wfh_days.includes(day)
        ? f.wfh_days.filter((d) => d !== day)
        : [...f.wfh_days, day]
      return { ...f, wfh_days: days }
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSubmitting(true)
    const { error } = await updateProfile({
      transport_amount: parseInt(form.transport_amount) || 14000,
      lunch_amount: parseInt(form.lunch_amount) || 15000,
      dinner_amount: parseInt(form.dinner_amount) || 15000,
      wfh_days: form.wfh_days,
      saving_percent: parseInt(form.saving_percent) || 20,
    })
    setSubmitting(false)
    if (error) {
      toast('Gagal menyimpan pengaturan 😢', 'error')
    } else {
      toast('Pengaturan tersimpan! ✅', 'success')
    }
  }

  // Hitung estimasi pengeluaran mingguan berdasarkan form
  const estWeekly = (() => {
    const transport = parseInt(form.transport_amount) || 0
    const lunch = parseInt(form.lunch_amount) || 0
    const dinner = parseInt(form.dinner_amount) || 0
    const workDays = 5
    const wfhCount = form.wfh_days.filter((d) => d >= 1 && d <= 5).length
    const transportDays = workDays - wfhCount
    return (transport * transportDays) + ((lunch + dinner) * workDays)
  })()

  return (
    <div className="page">
      <header className="page__header">
        <h1 className="page__title">Pengaturan ⚙️</h1>
      </header>

      <main className="page__content">
        {/* Info akun */}
        <section className="card">
          <p className="card__label">Akun kamu</p>
          <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{user?.email}</p>
          <button className="btn btn--ghost btn--sm" onClick={signOut}>
            🚪 Keluar
          </button>
        </section>

        {/* Form pengaturan */}
        <form className="card" onSubmit={handleSave}>
          <h2 className="section__title" style={{ marginBottom: '1rem' }}>Pengeluaran rutin harian</h2>

          <div className="form-group">
            <label className="form-label" htmlFor="transport">
              🚌 Ongkos transport pulang-pergi (Rp)
            </label>
            <input
              id="transport"
              type="number"
              className="form-input"
              value={form.transport_amount}
              onChange={(e) => setForm((f) => ({ ...f, transport_amount: e.target.value }))}
              inputMode="numeric"
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="lunch">
              🍱 Default makan siang (Rp)
            </label>
            <input
              id="lunch"
              type="number"
              className="form-input"
              value={form.lunch_amount}
              onChange={(e) => setForm((f) => ({ ...f, lunch_amount: e.target.value }))}
              inputMode="numeric"
              min="0"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="dinner">
              🍜 Default makan malam (Rp)
            </label>
            <input
              id="dinner"
              type="number"
              className="form-input"
              value={form.dinner_amount}
              onChange={(e) => setForm((f) => ({ ...f, dinner_amount: e.target.value }))}
              inputMode="numeric"
              min="0"
            />
          </div>

          <div className="form-group">
            <p className="form-label">🏠 Hari WFH (tidak ada ongkos transport)</p>
            <div className="day-toggle-group" role="group" aria-label="Pilih hari WFH">
              {[1, 2, 3, 4, 5].map((day) => (
                <button
                  key={day}
                  type="button"
                  className={`day-toggle ${form.wfh_days.includes(day) ? 'day-toggle--active' : ''}`}
                  onClick={() => toggleWfhDay(day)}
                  aria-pressed={form.wfh_days.includes(day)}
                >
                  {DAY_LABELS[day].slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="saving-pct">
              🐷 Persentase nabung dari uang jajan ({form.saving_percent}%)
            </label>
            <input
              id="saving-pct"
              type="range"
              min="5"
              max="50"
              step="5"
              value={form.saving_percent}
              onChange={(e) => setForm((f) => ({ ...f, saving_percent: Number(e.target.value) }))}
              style={{ width: '100%', accentColor: 'var(--color-peach)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              <span>5%</span><span>50%</span>
            </div>
          </div>

          {/* Estimasi pengeluaran */}
          <div className="info-box">
            <p>📊 Estimasi pengeluaran mingguanmu: <strong>{formatRupiah(estWeekly)}</strong></p>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
              (transport {5 - form.wfh_days.filter(d=>d>=1&&d<=5).length} hari + makan 5 hari)
            </p>
          </div>

          <button type="submit" className="btn btn--primary" disabled={submitting} style={{ width: '100%', marginTop: '0.5rem' }}>
            {submitting ? 'Menyimpan...' : '💾 Simpan Pengaturan'}
          </button>
        </form>

        <p className="text-muted" style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '1rem' }}>
          duit.ku v0.1.0 · dibuat dengan 🧡
        </p>
      </main>
    </div>
  )
}
