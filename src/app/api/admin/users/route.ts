import { NextResponse } from 'next/server'
import { getSupabaseAnonClient, getSupabaseServiceClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

async function isAdmin(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
  if (!token) return false
  const supabase = getSupabaseAnonClient()
  const { data } = await supabase.auth.getUser(token)
  if (!data.user) return false
  
  const server = getSupabaseServiceClient()
  const { data: profile } = await server.from('profiles').select('role').eq('id', data.user.id).single()
  return profile?.role === 'admin'
}

export async function GET(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = getSupabaseServiceClient()
  
  // Fetch profiles with email and role
  // Also fetching balance would be nice, but balance is calculated from ledger.
  // We can do a join or separate queries. Ledger sum per user is heavy.
  // For now, let's fetch profiles and maybe top 50.
  
  const { data: profiles, error } = await server
    .from('profiles')
    .select('id, email, role, created_at, is_withdraw_blocked')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: 'failed_fetch_users' }, { status: 500 })

  // Calculate balance for these users
  const userIds = profiles.map(p => p.id)
  
  // Aggregate ledger
  const { data: ledger } = await server
    .from('kograph_balance_ledger')
    .select('user_id, amount')
    .in('user_id', userIds)

  const balances: Record<string, number> = {}
  ledger?.forEach((row: any) => {
    balances[row.user_id] = (balances[row.user_id] || 0) + Number(row.amount)
  })

  const users = profiles.map(p => ({
    ...p,
    balance: balances[p.id] || 0
  }))

  return NextResponse.json({ users })
}
