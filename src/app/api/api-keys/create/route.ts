import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseAnonClient, getSupabaseServiceClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function randomHex(len: number) {
  return crypto.randomBytes(len).toString('hex')
}

function randomBase64Url(len: number) {
  return crypto.randomBytes(len).toString('base64url')
}

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
  const name = String(body?.name ?? 'API Key').slice(0, 80).trim() || 'API Key'

  const keyPrefix = randomHex(4)
  const secret = randomBase64Url(24)
  const apiKey = `kg_${keyPrefix}_${secret}`
  const keyHash = sha256Hex(apiKey)

  const server = getSupabaseServiceClient()
  const { error } = await server.from('kograph_api_keys').insert({
    user_id: userId,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
  })

  if (error) return NextResponse.json({ error: 'create_failed' }, { status: 500 })

  await server.from('kograph_audit_logs').insert({
    actor_user_id: userId,
    subject_user_id: userId,
    action: 'api_key_created',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { name, keyPrefix },
  })

  return NextResponse.json({ apiKey })
}

