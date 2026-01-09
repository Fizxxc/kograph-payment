'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = getSupabaseBrowser()
      const r = await supabase.auth.signUp({ email, password })
      if (r.error) {
        console.error('Register Error:', r.error)
        setError(r.error.message || 'Gagal mendaftar.')
        return
      }
      router.push('/dashboard')
    } catch (err: any) {
      console.error('System Error:', err)
      setError(err?.message || 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900 }}>Buat Akun</h1>
        <p style={{ color: 'var(--muted)' }}>Siap menerima pembayaran via QRIS (Saweria)</p>
      </div>

      <div className="card">
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Email</label>
            <input
              className="input"
              placeholder="nama@email.com"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Password</label>
            <input
              className="input"
              placeholder="••••••••"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div
              style={{
                padding: 12,
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#991b1b',
                borderRadius: 8,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: 8 }}
          >
            {loading ? 'Mendaftarkan...' : 'Daftar'}
          </button>
        </form>
      </div>

      <div style={{ textAlign: 'center', marginTop: 24, color: 'var(--muted)' }}>
        Sudah punya akun?{' '}
        <Link href="/auth/login" style={{ fontWeight: 700, textDecoration: 'underline' }}>
          Login
        </Link>
      </div>
    </div>
  )
}
