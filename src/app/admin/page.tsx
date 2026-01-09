'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

type AuditLogRow = {
  id: string
  actor_user_id: string | null
  subject_user_id: string | null
  action: string
  ip: string | null
  user_agent: string | null
  details: unknown
  created_at: string
}

type WithdrawalRow = {
  id: string
  user_id: string
  amount: number
  status: string
  note: string | null
  created_at: string
  updated_at: string
  paid_at: string | null
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audit, setAudit] = useState<AuditLogRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])

  const refresh = async () => {
    setError(null)
    const supabase = getSupabaseBrowser()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) {
      setAllowed(false)
      setLoading(false)
      return
    }
    const roleRes = await fetch('/api/admin/me', { headers: { Authorization: `Bearer ${token}` } })
    if (!roleRes.ok) {
      setAllowed(false)
      setLoading(false)
      return
    }
    const roleJ = (await roleRes.json()) as { role: string }
    if (roleJ.role !== 'admin') {
      setAllowed(false)
      setLoading(false)
      return
    }
    setAllowed(true)

    const [a, w] = await Promise.all([
      fetch('/api/admin/audit', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/withdrawals', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    if (!a.ok) {
      setError(await a.text())
      setLoading(false)
      return
    }
    if (!w.ok) {
      setError(await w.text())
      setLoading(false)
      return
    }
    setAudit(((await a.json()) as { rows: AuditLogRow[] }).rows)
    setWithdrawals(((await w.json()) as { rows: WithdrawalRow[] }).rows)
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      refresh().catch(() => {
        setError('Gagal memuat admin dashboard.')
        setLoading(false)
      })
    }, 0)
    return () => clearTimeout(t)
  }, [])

  const updateWithdrawal = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
    setError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setError('Silakan login.')
        return
      }
      const r = await fetch('/api/admin/withdrawals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok) {
        setError(j?.error ?? 'Gagal update withdraw.')
        return
      }
      await refresh()
    } catch {
      setError('Gagal update withdraw.')
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <div className="card">Memuat...</div>
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="container" style={{ padding: '32px 0' }}>
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Akses ditolak</div>
          <div style={{ color: 'var(--muted)' }}>Halaman ini hanya untuk admin.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '32px 0', display: 'grid', gap: 16 }}>
      <div className="card" style={{ display: 'grid', gap: 6 }}>
        <div style={{ fontWeight: 950, fontSize: 22 }}>Dashboard Admin</div>
        <div style={{ color: 'var(--muted)' }}>Monitor aktivitas user dan withdraw untuk mencegah penyalahgunaan.</div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.06)' }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Error</div>
          <div style={{ marginTop: 6, color: '#7f1d1d' }}>{error}</div>
        </div>
      )}

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Withdraw Requests</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {withdrawals.length === 0 && <div style={{ color: 'var(--muted)' }}>Tidak ada withdraw.</div>}
          {withdrawals.map((w) => (
            <div
              key={w.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                padding: 12,
                borderRadius: 14,
                border: '1px solid rgba(2, 6, 23, 0.10)',
                background: 'rgba(2, 6, 23, 0.02)',
              }}
            >
              <div style={{ display: 'grid', gap: 2 }}>
                <div style={{ fontWeight: 900 }}>Rp {Number(w.amount).toLocaleString('id-ID')}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>User {w.user_id}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{w.note ?? '—'}</div>
              </div>
              <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                <div style={{ fontWeight: 850 }}>{w.status}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button className="btn" disabled={w.status !== 'requested'} onClick={() => updateWithdrawal(w.id, 'approved')}>
                    Approve
                  </button>
                  <button className="btn" disabled={w.status !== 'requested'} onClick={() => updateWithdrawal(w.id, 'rejected')}>
                    Reject
                  </button>
                  <button className="btn btn-primary" disabled={w.status !== 'approved'} onClick={() => updateWithdrawal(w.id, 'paid')}>
                    Mark Paid
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ display: 'grid', gap: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>Audit Log</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {audit.length === 0 && <div style={{ color: 'var(--muted)' }}>Belum ada audit log.</div>}
          {audit.map((a) => (
            <div
              key={a.id}
              style={{
                padding: 12,
                borderRadius: 14,
                border: '1px solid rgba(2, 6, 23, 0.10)',
                background: 'rgba(2, 6, 23, 0.02)',
                display: 'grid',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 900 }}>{a.action}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(a.created_at).toLocaleString('id-ID')}</div>
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                actor {a.actor_user_id ?? '—'} · subject {a.subject_user_id ?? '—'}
              </div>
              <div style={{ color: 'var(--muted)', fontSize: 12, wordBreak: 'break-word' }}>
                {a.ip ?? '—'} · {(a.user_agent ?? '—').slice(0, 120)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
