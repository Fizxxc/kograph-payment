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

export async function POST(req: Request) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const { userId, action, message } = body // action: 'block_withdraw', 'unblock_withdraw', 'warn'

  if (!userId || !action) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })

  const server = getSupabaseServiceClient()

  if (action === 'block_withdraw') {
    await server.from('profiles').update({ is_withdraw_blocked: true }).eq('id', userId)
    await server.from('kograph_audit_logs').insert({
      action: 'user_withdraw_blocked',
      subject_user_id: userId,
      details: { reason: message }
    })
  } else if (action === 'unblock_withdraw') {
    await server.from('profiles').update({ is_withdraw_blocked: false }).eq('id', userId)
    await server.from('kograph_audit_logs').insert({
      action: 'user_withdraw_unblocked',
      subject_user_id: userId,
      details: { reason: message }
    })
  } else if (action === 'warn') {
    if (!message) return NextResponse.json({ error: 'message_required' }, { status: 400 })
    await server.from('kograph_notifications').insert({
      user_id: userId,
      title: 'Peringatan Admin',
      message: message,
    })
    await server.from('kograph_audit_logs').insert({
      action: 'user_warned',
      subject_user_id: userId,
      details: { message }
    })
  } else {
    return NextResponse.json({ error: 'unknown_action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
