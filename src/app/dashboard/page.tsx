'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

type ApiKeyRow = {
  id: string
  name: string
  key_prefix: string
  revoked_at: string | null
  created_at: string
}

type CheckoutRow = {
  id: string
  amount: number
  status: string
  description: string | null
  created_at: string
  paid_at: string | null
}

type WithdrawalRow = {
  id: string
  amount: number
  status: string
  created_at: string
  paid_at: string | null
  note: string | null
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [authed, setAuthed] = useState(false)
  const [balance, setBalance] = useState<number>(0)
  const [defaultAmount, setDefaultAmount] = useState<number>(10000)
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([])
  const [checkouts, setCheckouts] = useState<CheckoutRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [error, setError] = useState<string | null>(null)

  const [newKeyName, setNewKeyName] = useState('My API Key')
  const [createdKey, setCreatedKey] = useState<string | null>(null)

  const [checkoutAmount, setCheckoutAmount] = useState<number>(10000)
  const [checkoutDesc, setCheckoutDesc] = useState<string>('')
  const [checkoutInstruction, setCheckoutInstruction] = useState<{ message: string; donationUrl: string } | null>(null)

  const [withdrawAmount, setWithdrawAmount] = useState<number>(0)
  const [withdrawNote, setWithdrawNote] = useState<string>('')

  const formattedBalance = useMemo(() => {
    return `Rp ${Math.max(0, Math.floor(balance)).toLocaleString('id-ID')}`
  }, [balance])

  const refresh = async () => {
    setError(null)
    const supabase = getSupabaseBrowser()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setAuthed(false)
      setLoading(false)
      return
    }
    setAuthed(true)
    const r = await fetch('/api/me/overview', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) {
      setError(await r.text())
      setLoading(false)
      return
    }
    const j = (await r.json()) as {
      balance: number
      defaultAmount: number
      apiKeys: ApiKeyRow[]
      checkouts: CheckoutRow[]
      withdrawals: WithdrawalRow[]
    }
    setBalance(j.balance)
    setDefaultAmount(Number(j.defaultAmount) || 10000)
    setCheckoutAmount(Number(j.defaultAmount) || 10000)
    setApiKeys(j.apiKeys)
    setCheckouts(j.checkouts)
    setWithdrawals(j.withdrawals)
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      refresh().catch(() => {
        setError('Gagal memuat dashboard.')
        setLoading(false)
      })
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const createKey = async () => {
    setError(null)
    setCreatedKey(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Silakan login.')
        return
      }
      const r = await fetch('/api/api-keys/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newKeyName }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j?.error ?? 'Gagal membuat API key.')
        return
      }
      setCreatedKey(j.apiKey as string)
      await refresh()
    } catch {
      setError('Gagal membuat API key.')
    }
  }

  const revokeKey = async (id: string) => {
    setError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Silakan login.')
        return
      }
      const r = await fetch('/api/api-keys/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        setError(j?.error ?? 'Gagal revoke API key.')
        return
      }
      await refresh()
    } catch {
      setError('Gagal revoke API key.')
    }
  }

  const saveDefaultAmount = async () => {
    setError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Silakan login.')
        return
      }
      const r = await fetch('/api/settings/default-amount', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ defaultAmount }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => null)
        setError(j?.error ?? 'Gagal menyimpan.')
        return
      }
      await refresh()
    } catch {
      setError('Gagal menyimpan.')
    }
  }

  const createCheckout = async () => {
    setError(null)
    setCheckoutInstruction(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Silakan login.')
        return
      }
      const r = await fetch('/api/checkouts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: checkoutAmount, description: checkoutDesc || null }),
      })
      const j = await r.json()
      if (!r.ok) {
        setError(j?.error ?? 'Gagal membuat checkout.')
        return
      }
      setCheckoutInstruction({ message: j.message, donationUrl: j.donationUrl })
      await refresh()
    } catch {
      setError('Gagal membuat checkout.')
    }
  }

  const requestWithdraw = async () => {
    setError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Silakan login.')
        return
      }
      const r = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: withdrawAmount, note: withdrawNote || null }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        setError(j?.error ?? 'Gagal mengajukan withdraw.')
        return
      }
      setWithdrawAmount(0)
      setWithdrawNote('')
      await refresh()
    } catch {
      setError('Gagal mengajukan withdraw.')
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <div className="card">Memuat...</div>
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <div className="card" style={{ display: 'grid', gap: 10 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Anda belum login</div>
          <div style={{ color: 'var(--muted)' }}>Login untuk mengelola saldo dan API key.</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a className="btn btn-primary" href="/auth/login">
              Login
            </a>
            <a className="btn" href="/auth/register">
              Daftar
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container section grid">
      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(56, 189, 248, 0.10))',
          borderColor: 'rgba(99, 102, 241, 0.22)',
        }}
      >
        <div>
          <div className="h1">Dashboard</div>
          <div className="muted">Kelola API key, checkout, dan withdraw.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="pill">Saldo</div>
          <div style={{ fontWeight: 950, fontSize: 20 }}>{formattedBalance}</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.06)' }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Error</div>
          <div style={{ marginTop: 6, color: '#7f1d1d' }}>{error}</div>
        </div>
      )}

      <div className="grid">
        <div className="card card-soft grid" style={{ gap: 12 }}>
          <div className="h2">Pengaturan Nominal Default</div>
          <div style={{ display: 'grid', gap: 8, maxWidth: 360 }}>
            <input
              className="input"
              type="number"
              min={1000}
              step={1000}
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(Number(e.target.value))}
            />
            <button className="btn btn-primary" onClick={saveDefaultAmount}>
              Simpan
            </button>
          </div>
        </div>

        <div className="card grid" style={{ gap: 12 }}>
          <div className="h2">API Keys</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input className="input" style={{ maxWidth: 340 }} value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
            <button className="btn btn-primary" onClick={createKey}>
              Buat API Key
            </button>
          </div>
          {createdKey && (
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 800 }}>API key baru (simpan sekarang):</div>
              <div className="card" style={{ boxShadow: 'none', borderStyle: 'dashed' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>
                  {createdKey}
                </div>
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gap: 10 }}>
            {apiKeys.length === 0 && <div style={{ color: 'var(--muted)' }}>Belum ada API key.</div>}
            {apiKeys.map((k) => (
              <div key={k.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'grid' }}>
                  <div style={{ fontWeight: 850 }}>{k.name}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    Prefix {k.key_prefix} · {k.revoked_at ? 'Revoked' : 'Aktif'}
                  </div>
                </div>
                <button className="btn" disabled={!!k.revoked_at} onClick={() => revokeKey(k.id)}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card grid" style={{ gap: 12 }}>
          <div className="h2">Buat Checkout (Topup)</div>
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <input
              className="input"
              type="number"
              min={1000}
              step={1000}
              value={checkoutAmount}
              onChange={(e) => setCheckoutAmount(Number(e.target.value))}
            />
            <input className="input" placeholder="Deskripsi (opsional)" value={checkoutDesc} onChange={(e) => setCheckoutDesc(e.target.value)} />
            <button className="btn btn-primary" onClick={createCheckout}>
              Buat Checkout
            </button>
          </div>
          {checkoutInstruction && (
            <div style={{ display: 'grid', gap: 10 }}>
              <div className="muted">
                Buka Saweria, lalu isi message dengan kode ini (wajib) agar saldo masuk ke akun Anda:
              </div>
              <div className="card" style={{ boxShadow: 'none', borderStyle: 'dashed' }}>
                <div style={{ fontFamily: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                  {checkoutInstruction.message}
                </div>
              </div>
              <a className="btn btn-primary" href={checkoutInstruction.donationUrl} target="_blank" rel="noreferrer">
                Buka Halaman Saweria
              </a>
            </div>
          )}
        </div>

        <div className="card grid" style={{ gap: 12 }}>
          <div className="h2">Riwayat Checkout</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {checkouts.length === 0 && <div style={{ color: 'var(--muted)' }}>Belum ada checkout.</div>}
            {checkouts.map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid' }}>
                  <div style={{ fontWeight: 850 }}>Rp {Number(c.amount).toLocaleString('id-ID')}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{c.description ?? '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 850 }}>{c.status}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(c.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card grid" style={{ gap: 12 }}>
          <div className="h2">Withdraw</div>
          <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
            <input
              className="input"
              type="number"
              min={1000}
              step={1000}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(Number(e.target.value))}
              placeholder="Nominal withdraw"
            />
            <input className="input" value={withdrawNote} onChange={(e) => setWithdrawNote(e.target.value)} placeholder="Catatan (opsional)" />
            <button className="btn btn-primary" onClick={requestWithdraw}>
              Ajukan Withdraw
            </button>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            {withdrawals.length === 0 && <div style={{ color: 'var(--muted)' }}>Belum ada withdraw.</div>}
            {withdrawals.map((w) => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'grid' }}>
                  <div style={{ fontWeight: 850 }}>Rp {Number(w.amount).toLocaleString('id-ID')}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{w.note ?? '—'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 850 }}>{w.status}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    {new Date(w.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
