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

async function getRole(userId: string) {
  const server = getSupabaseServiceClient()
  const { data } = await server.from('profiles').select('role').eq('id', userId).maybeSingle()
  return (data?.role ?? 'user') as string
}

export async function POST(req: Request) {
  const actorId = await getUserIdFromRequest(req)
  if (!actorId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if ((await getRole(actorId)) !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const id = String(body?.id ?? '')
  const status = String(body?.status ?? '')
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })
  if (!['approved', 'rejected', 'paid'].includes(status)) return NextResponse.json({ error: 'invalid_status' }, { status: 400 })

  const server = getSupabaseServiceClient()
  const { data: w, error: wErr } = await server
    .from('kograph_withdrawals')
    .select('id,user_id,amount,status,paid_at')
    .eq('id', id)
    .maybeSingle()

  if (wErr || !w) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (status === 'paid') {
    if (w.status !== 'approved') return NextResponse.json({ error: 'must_be_approved' }, { status: 400 })
    if (w.paid_at) return NextResponse.json({ ok: true })

    const paidAt = new Date().toISOString()
    const { error: updErr } = await server
      .from('kograph_withdrawals')
      .update({ status: 'paid', paid_at: paidAt })
      .eq('id', id)
      .eq('status', 'approved')
      .is('paid_at', null)

    if (updErr) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

    const { error: ledgerErr } = await server.from('kograph_balance_ledger').insert({
      user_id: w.user_id,
      checkout_id: null,
      entry_type: 'withdrawal',
      amount: -Math.abs(Number(w.amount)),
      meta: { withdrawal_id: w.id },
    })

    if (ledgerErr) return NextResponse.json({ error: 'ledger_failed' }, { status: 500 })

    await server.from('kograph_audit_logs').insert({
      actor_user_id: actorId,
      subject_user_id: w.user_id,
      action: 'withdrawal_paid',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      details: { withdrawalId: w.id, amount: w.amount },
    })

    return NextResponse.json({ ok: true })
  }

  if (status === 'approved') {
    if (w.status !== 'requested') return NextResponse.json({ error: 'invalid_transition' }, { status: 400 })
    const { error: updErr } = await server.from('kograph_withdrawals').update({ status: 'approved' }).eq('id', id).eq('status', 'requested')
    if (updErr) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    await server.from('kograph_audit_logs').insert({
      actor_user_id: actorId,
      subject_user_id: w.user_id,
      action: 'withdrawal_approved',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      details: { withdrawalId: w.id, amount: w.amount },
    })
    return NextResponse.json({ ok: true })
  }

  if (status === 'rejected') {
    if (w.status !== 'requested') return NextResponse.json({ error: 'invalid_transition' }, { status: 400 })
    const { error: updErr } = await server.from('kograph_withdrawals').update({ status: 'rejected' }).eq('id', id).eq('status', 'requested')
    if (updErr) return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    await server.from('kograph_audit_logs').insert({
      actor_user_id: actorId,
      subject_user_id: w.user_id,
      action: 'withdrawal_rejected',
      ip: req.headers.get('x-forwarded-for'),
      user_agent: req.headers.get('user-agent'),
      details: { withdrawalId: w.id, amount: w.amount },
    })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'invalid' }, { status: 400 })
}

