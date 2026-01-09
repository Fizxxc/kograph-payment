import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export async function POST(req: Request) {
  const apiKey = req.headers.get('x-kograph-key')
  if (!apiKey) return NextResponse.json({ error: 'missing_api_key' }, { status: 401 })
  const keyHash = sha256Hex(apiKey)

  const server = getSupabaseServiceClient()
  const { data: keyRow, error: keyErr } = await server
    .from('kograph_api_keys')
    .select('id,user_id,key_hash,revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (keyErr) return NextResponse.json({ error: 'auth_failed' }, { status: 401 })
  if (!keyRow || keyRow.revoked_at) return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 })
  if (!safeEqualHex(String(keyRow.key_hash), keyHash)) return NextResponse.json({ error: 'invalid_api_key' }, { status: 401 })

  const donationUrl = process.env.SAWERIA_DONATION_URL
  if (!donationUrl) return NextResponse.json({ error: 'missing_saweria_url' }, { status: 500 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const description = body?.description ? String(body.description).slice(0, 200) : null
  if (!Number.isFinite(amount) || amount < 1000) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })

  const { data: checkout, error: checkoutErr } = await server
    .from('kograph_checkouts')
    .insert({
      user_id: keyRow.user_id,
      api_key_id: keyRow.id,
      kind: 'api',
      amount,
      description,
      status: 'pending',
    })
    .select('id')
    .single()

  if (checkoutErr || !checkout?.id) return NextResponse.json({ error: 'create_failed' }, { status: 500 })

  const message = `KO:${checkout.id}`

  await server.from('kograph_audit_logs').insert({
    actor_user_id: keyRow.user_id,
    subject_user_id: keyRow.user_id,
    action: 'checkout_created_api',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { checkoutId: checkout.id, amount, apiKeyId: keyRow.id },
  })

  return NextResponse.json({ checkoutId: checkout.id, donationUrl, message })
}

