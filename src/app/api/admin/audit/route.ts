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

async function isAdmin(userId: string) {
  const server = getSupabaseServiceClient()
  const { data } = await server.from('profiles').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export async function GET(req: Request) {
  const userId = await getUserIdFromRequest(req)
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!(await isAdmin(userId))) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const server = getSupabaseServiceClient()
  const { data, error } = await server
    .from('kograph_audit_logs')
    .select('id,actor_user_id,subject_user_id,action,ip,user_agent,details,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: 'query_failed' }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

