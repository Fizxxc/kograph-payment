import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getSupabaseServiceClient } from '@/lib/supabaseServer'

export const runtime = 'nodejs'

function hmacSha256Hex(secret: string, message: string) {
  return crypto.createHmac('sha256', secret).update(message).digest('hex')
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

type SaweriaPayload = {
  version: string
  created_at: string
  id: string
  type: string
  amount_raw: number
  cut?: number
  donator_name: string
  donator_email: string
  message?: string
}

function extractCheckoutId(message: string | undefined) {
  if (!message) return null
  const m = message.match(/KO:([0-9a-fA-F-]{36})/)
  return m?.[1] ?? null
}

export async function POST(req: Request) {
  const streamKey = process.env.SAWERIA_STREAM_KEY
  if (!streamKey) return NextResponse.json({ error: 'missing_stream_key' }, { status: 500 })

  const signature = req.headers.get('saweria-callback-signature')
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 401 })
  const sig = signature.startsWith('sha256=') ? signature.slice(7) : signature

  const body = (await req.json().catch(() => null)) as SaweriaPayload | null
  if (!body?.id || !body.version) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const msg = `${body.version}${body.id}${body.amount_raw}${body.donator_name}${body.donator_email}`
  const expected = hmacSha256Hex(streamKey, msg)
  if (!safeEqualHex(expected, sig)) return NextResponse.json({ error: 'bad_signature' }, { status: 401 })

  const checkoutId = extractCheckoutId(body.message)
  if (!checkoutId) return NextResponse.json({ error: 'missing_checkout_code' }, { status: 400 })

  const server = getSupabaseServiceClient()
  const { data: checkout, error: checkoutErr } = await server
    .from('kograph_checkouts')
    .select('id,user_id,status,amount')
    .eq('id', checkoutId)
    .maybeSingle()

  if (checkoutErr || !checkout) return NextResponse.json({ error: 'checkout_not_found' }, { status: 404 })
  if (checkout.status === 'paid') return NextResponse.json({ ok: true })

  const cut = Number(body.cut ?? 0)
  const net = Math.max(0, Number(body.amount_raw) - (Number.isFinite(cut) ? cut : 0))

  const { error: updateErr } = await server
    .from('kograph_checkouts')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      saweria_event_id: body.id,
    })
    .eq('id', checkout.id)
    .eq('status', 'pending')

  if (updateErr) return NextResponse.json({ error: 'update_failed' }, { status: 500 })

  const { error: ledgerErr } = await server.from('kograph_balance_ledger').insert({
    user_id: checkout.user_id,
    checkout_id: checkout.id,
    entry_type: 'topup',
    amount: net,
    meta: {
      amount_raw: body.amount_raw,
      cut: body.cut ?? 0,
      donator_name: body.donator_name,
      donator_email: body.donator_email,
      message: body.message ?? null,
      saweria_event_id: body.id,
    },
  })

  if (ledgerErr) return NextResponse.json({ error: 'ledger_failed' }, { status: 500 })

  await server.from('kograph_audit_logs').insert({
    actor_user_id: checkout.user_id,
    subject_user_id: checkout.user_id,
    action: 'checkout_paid',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { checkoutId: checkout.id, saweriaEventId: body.id, amountRaw: body.amount_raw, net },
  })

  return NextResponse.json({ ok: true })
}

