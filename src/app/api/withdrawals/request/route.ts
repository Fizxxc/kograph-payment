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

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const note = body?.note ? String(body.note).slice(0, 200) : null
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
  if (amount % 1000 !== 0) return NextResponse.json({ error: 'amount_must_be_multiple_of_1000' }, { status: 400 })

  const server = getSupabaseServiceClient()
  
  // Check if user is blocked
  const { data: profile } = await server.from('profiles').select('is_withdraw_blocked').eq('id', userId).single()
  if (profile?.is_withdraw_blocked) {
    return NextResponse.json({ error: 'withdrawal_blocked' }, { status: 403 })
  }

  const balance = await sumLedgerBalance(userId)
  if (balance < amount) return NextResponse.json({ error: 'insufficient_balance' }, { status: 400 })

  const { data: withdrawal, error } = await server.from('kograph_withdrawals').insert({
    user_id: userId,
    amount,
    status: 'requested',
    note,
  }).select().single()

  if (error || !withdrawal) return NextResponse.json({ error: 'create_failed' }, { status: 500 })

  // Deduct balance immediately
  await server.from('kograph_balance_ledger').insert({
    user_id: userId,
    checkout_id: null,
    entry_type: 'withdrawal_request',
    amount: -amount,
    meta: { withdrawal_id: withdrawal.id }
  })
  if (error) return NextResponse.json({ error: 'create_failed' }, { status: 500 })

  await server.from('kograph_audit_logs').insert({
    actor_user_id: userId,
    subject_user_id: userId,
    action: 'withdrawal_requested',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { amount },
  })

  return NextResponse.json({ ok: true })
}
