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

type UserRow = {
  id: string
  email: string
  role: string
  created_at: string
  is_withdraw_blocked: boolean
  balance: number
}

export default function AdminPage() {
  const [loading, setLoading] = useState(true)
  const [allowed, setAllowed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'users' | 'withdrawals' | 'audit'>('users')
  
  const [audit, setAudit] = useState<AuditLogRow[]>([])
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])

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

    const [a, w, u] = await Promise.all([
      fetch('/api/admin/audit', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/withdrawals', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
    ])
    
    if (!a.ok || !w.ok || !u.ok) {
      setError('Gagal memuat data.')
      setLoading(false)
      return
    }

    setAudit(((await a.json()) as { rows: AuditLogRow[] }).rows)
    setWithdrawals(((await w.json()) as { rows: WithdrawalRow[] }).rows)
    setUsers(((await u.json()) as { users: UserRow[] }).users)
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => {
      refresh().catch(() => {
        setError('Gagal memuat admin dashboard.')
        setLoading(false)
      })
    }, 0)
    
    // Set up Realtime Subscription
    const supabase = getSupabaseBrowser()
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kograph_withdrawals' }, () => refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kograph_balance_ledger' }, () => refresh()) // To update balances
      .subscribe()

    return () => {
      clearTimeout(t)
      supabase.removeChannel(channel)
    }
  }, [])

  const updateWithdrawal = async (id: string, status: 'approved' | 'rejected' | 'paid') => {
    setError(null)
    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      const r = await fetch('/api/admin/withdrawals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status }),
      })
      if (!r.ok) {
        const j = await r.json()
        setError(j?.error ?? 'Gagal update withdraw.')
      } else {
        await refresh()
      }
    } catch {
      setError('Gagal update withdraw.')
    }
  }

  const handleUserAction = async (userId: string, action: string, message?: string) => {
    if (action === 'warn' && !message) return
    if (!confirm('Apakah Anda yakin melakukan tindakan ini?')) return

    try {
      const supabase = getSupabaseBrowser()
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) return

      const r = await fetch('/api/admin/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, action, message }),
      })

      if (!r.ok) {
        const j = await r.json()
        alert(j.error || 'Gagal melakukan aksi')
      } else {
        alert('Sukses!')
        await refresh()
      }
    } catch {
      alert('Gagal melakukan aksi')
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
        <div style={{ fontWeight: 950, fontSize: 22 }}>Admin Dashboard</div>
        <div style={{ color: 'var(--muted)' }}>
          Kelola user, withdrawal, dan keamanan sistem secara realtime.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
        <button className={`btn ${activeTab === 'users' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('users')}>Users</button>
        <button className={`btn ${activeTab === 'withdrawals' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('withdrawals')}>Withdrawals</button>
        <button className={`btn ${activeTab === 'audit' ? 'btn-primary' : ''}`} onClick={() => setActiveTab('audit')}>Audit Log</button>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.06)' }}>
          <div style={{ fontWeight: 800, color: '#b91c1c' }}>Error</div>
          <div style={{ marginTop: 6, color: '#7f1d1d' }}>{error}</div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Daftar Pengguna ({users.length})</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {users.map((u) => (
              <div key={u.id} style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(2, 6, 23, 0.10)', background: 'rgba(2, 6, 23, 0.02)', display: 'grid', gap: 8 }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{u.email}</div>
                      <div style={{ color: 'var(--muted)', fontSize: 12 }}>ID: {u.id}</div>
                      <div style={{ marginTop: 4, fontWeight: 700, color: u.is_withdraw_blocked ? 'red' : 'green' }}>
                        {u.is_withdraw_blocked ? 'Withdraw Blocked' : 'Active'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                       <div style={{ fontSize: 12, color: 'var(--muted)' }}>Saldo</div>
                       <div style={{ fontWeight: 900, fontSize: 18 }}>Rp {u.balance.toLocaleString('id-ID')}</div>
                    </div>
                 </div>
                 <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    <button className="btn" onClick={() => {
                        const msg = prompt('Masukkan pesan peringatan:')
                        if (msg) handleUserAction(u.id, 'warn', msg)
                    }}>Beri Peringatan</button>
                    
                    {u.is_withdraw_blocked ? (
                        <button className="btn btn-primary" onClick={() => handleUserAction(u.id, 'unblock_withdraw')}>Buka Blokir WD</button>
                    ) : (
                        <button className="btn" style={{ background: '#fee2e2', color: '#ef4444', borderColor: '#fca5a5' }} onClick={() => handleUserAction(u.id, 'block_withdraw')}>Blokir WD</button>
                    )}
                 </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'withdrawals' && (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 16 }}>Permintaan Withdraw</div>
          <div style={{ display: 'grid', gap: 10 }}>
            {withdrawals.length === 0 && <div style={{ color: 'var(--muted)' }}>Tidak ada withdraw.</div>}
            {withdrawals.map((w) => (
              <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', padding: 12, borderRadius: 14, border: '1px solid rgba(2, 6, 23, 0.10)', background: 'rgba(2, 6, 23, 0.02)' }}>
                <div style={{ display: 'grid', gap: 2 }}>
                  <div style={{ fontWeight: 900 }}>Rp {Number(w.amount).toLocaleString('id-ID')}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>User {w.user_id}</div>
                  
                  {/* Destination Details */}
                  <div style={{ margin: '4px 0', padding: '4px 8px', background: 'rgba(0,0,0,0.05)', borderRadius: 6, width: 'fit-content' }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      {w.channel_code || 'MANUAL'} 
                      {w.channel_category ? ` (${w.channel_category})` : ''}
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: 14 }}>{w.account_number}</div>
                  </div>

                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{w.note ?? '—'}</div>
                </div>
                <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <div style={{ fontWeight: 850 }}>{w.status}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button className="btn" disabled={w.status !== 'requested'} onClick={() => updateWithdrawal(w.id, 'approved')}>Approve</button>
                    <button className="btn" disabled={w.status !== 'requested'} onClick={() => updateWithdrawal(w.id, 'rejected')}>Reject</button>
                    <button className="btn btn-primary" disabled={w.status !== 'approved'} onClick={() => updateWithdrawal(w.id, 'paid')}>Mark Paid</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card" style={{ display: 'grid', gap: 12 }}>
           <div style={{ fontWeight: 900, fontSize: 16 }}>Audit Log</div>
           <div style={{ display: 'grid', gap: 10 }}>
            {audit.map((a) => (
               <div key={a.id} style={{ padding: 12, borderRadius: 14, border: '1px solid rgba(2, 6, 23, 0.10)', background: 'rgba(2, 6, 23, 0.02)', display: 'grid', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 900 }}>{a.action}</div>
                    <div style={{ color: 'var(--muted)', fontSize: 12 }}>{new Date(a.created_at).toLocaleString('id-ID')}</div>
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>
                    actor {a.actor_user_id ?? '—'} · subject {a.subject_user_id ?? '—'}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, wordBreak: 'break-word' }}>
                    {JSON.stringify(a.details)}
                  </div>
               </div>
            ))}
           </div>
        </div>
      )}
    </div>
  )
}
