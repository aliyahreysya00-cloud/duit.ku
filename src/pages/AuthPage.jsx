import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import Mascot from '../components/Mascot'

export default function AuthPage() {
  const { signInWithMagicLink } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error } = await signInWithMagicLink(email.trim())
    setLoading(false)
    if (error) {
      setError('Aduh, ada yang salah. Coba cek emailnya lagi ya!')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__mascot">
          <Mascot mood={sent ? 'happy' : 'neutral'} size={90} />
        </div>

        <h1 className="auth-card__title">duit.ku 🐣</h1>
        <p className="auth-card__subtitle">
          Catatan keuanganmu yang lucu & hangat
        </p>

        {sent ? (
          <div className="auth-card__success">
            <p className="text-center">
              ✉️ Cek emailmu ya!<br />
              <strong>Link masuk</strong> udah aku kirimin ke<br />
              <em>{email}</em>
            </p>
            <p className="text-center text-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              Cek folder spam kalau belum masuk dalam 1 menit 🔍
            </p>
            <button
              className="btn btn--ghost"
              style={{ marginTop: '1rem', width: '100%' }}
              onClick={() => setSent(false)}
            >
              Ganti email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-card__form">
            <label htmlFor="email" className="form-label">
              Alamat email kamu
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              placeholder="kamu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
            {error && (
              <p className="form-error" role="alert">{error}</p>
            )}
            <button
              type="submit"
              className="btn btn--primary"
              disabled={loading || !email.trim()}
              style={{ width: '100%', marginTop: '0.5rem' }}
            >
              {loading ? '🐣 Sebentar...' : '✉️ Kirim link masuk'}
            </button>
            <p className="auth-card__note">
              Tanpa password — kami kirim link ajaib ke emailmu 🪄
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
