import { NextResponse } from 'next/server'
import { getSupabaseAnonClient, getSupabaseServiceClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

async function getUserIdFromRequest(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : null
  if (!token) return null
  const supabase = getSupabaseAnonClient()
  const { data, error } = await supabase.auth.getUser(token)
  if (error) return null
  return data.user?.id ?? null
}

async function sumLedgerBalance(userId: string) {
  const server = getSupabaseServiceClient()
  const { data, error } = await server
    .from('kograph_balance_ledger')
    .select('amount')
    .eq('user_id', userId)
  if (error) return 0
  return (data ?? []).reduce((acc, r) => acc + Number((r as { amount: unknown }).amount ?? 0), 0)
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const server = getSupabaseServiceClient()

  const [balance, settings, apiKeys, checkouts, withdrawals] = await Promise.all([
    sumLedgerBalance(userId),
    server.from('kograph_user_settings').select('default_amount').eq('user_id', userId).maybeSingle(),
    server
      .from('kograph_api_keys')
      .select('id,name,key_prefix,revoked_at,created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    server
      .from('kograph_checkouts')
      .select('id,amount,status,description,created_at,paid_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    server
      .from('kograph_withdrawals')
      .select('id,amount,status,created_at,paid_at,note')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  if (settings.error) return NextResponse.json({ error: 'settings_error' }, { status: 500 })
  if (apiKeys.error) return NextResponse.json({ error: 'api_keys_error' }, { status: 500 })
  if (checkouts.error) return NextResponse.json({ error: 'checkouts_error' }, { status: 500 })
  if (withdrawals.error) return NextResponse.json({ error: 'withdrawals_error' }, { status: 500 })

  return NextResponse.json({
    balance,
    defaultAmount: Number((settings.data as { default_amount?: unknown } | null)?.default_amount ?? 10000),
    apiKeys: apiKeys.data ?? [],
    checkouts: checkouts.data ?? [],
    withdrawals: withdrawals.data ?? [],
  })
}
