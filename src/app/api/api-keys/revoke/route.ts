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
  const id = String(body?.id ?? '')
  if (!id) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const server = getSupabaseServiceClient()
  const { error } = await server
    .from('kograph_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error) return NextResponse.json({ error: 'revoke_failed' }, { status: 500 })

  await server.from('kograph_audit_logs').insert({
    actor_user_id: userId,
    subject_user_id: userId,
    action: 'api_key_revoked',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { apiKeyId: id },
  })

  return NextResponse.json({ ok: true })
}

