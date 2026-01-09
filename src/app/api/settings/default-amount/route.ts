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

export async function POST(req: Request) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const defaultAmount = Number(body?.defaultAmount)
  if (!Number.isFinite(defaultAmount) || defaultAmount < 1000) {
    return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })
  }

  const server = getSupabaseServiceClient()
  const { error } = await server
    .from('kograph_user_settings')
    .upsert({ user_id: userId, default_amount: defaultAmount }, { onConflict: 'user_id' })
  if (error) return NextResponse.json({ error: 'save_failed' }, { status: 500 })

  await server.from('kograph_audit_logs').insert({
    actor_user_id: userId,
    subject_user_id: userId,
    action: 'settings_default_amount_updated',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { defaultAmount },
  })

  return NextResponse.json({ ok: true })
}

