'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'

export default function TopNav() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const supabase = getSupabaseBrowser()
        const { data } = await supabase.auth.getUser()
        if (cancelled) return
        const u = data.user
        setEmail(u?.email ?? null)
      } catch {
        if (cancelled) return
        setEmail(null)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <header className="topnav">
      <div className="container topnav-inner">
        <Link href="/" className="brand">
          Kograph
          <span className="brand-sub">Pay</span>
        </Link>

        <nav className="navlinks">
          <Link href="/dashboard" className="navlink">
            Dashboard
          </Link>
          {!email ? (
            <div className="nav-actions">
              <Link href="/auth/login" className="btn">
                Login
              </Link>
              <Link href="/auth/register" className="btn btn-primary">
                Daftar
              </Link>
            </div>
          ) : (
            <div className="nav-actions">
              <div className="nav-email">{email}</div>
              <button
                className="btn"
                onClick={async () => {
                  try {
                    const supabase = getSupabaseBrowser()
                    await supabase.auth.signOut()
                    window.location.assign('/')
                  } catch {}
                }}
              >
                Logout
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
