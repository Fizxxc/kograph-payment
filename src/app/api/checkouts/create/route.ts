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

  const donationUrl = process.env.SAWERIA_DONATION_URL
  if (!donationUrl) return NextResponse.json({ error: 'missing_saweria_url' }, { status: 500 })

  const body = await req.json().catch(() => null)
  const amount = Number(body?.amount)
  const description = body?.description ? String(body.description).slice(0, 200) : null
  if (!Number.isFinite(amount) || amount < 1000) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 })

  const server = getSupabaseServiceClient()
  const { data, error } = await server
    .from('kograph_checkouts')
    .insert({ user_id: userId, kind: 'web', amount, description, status: 'pending' })
    .select('id')
    .single()

  if (error || !data?.id) return NextResponse.json({ error: 'create_failed' }, { status: 500 })

  const message = `KO:${data.id}`

  await server.from('kograph_audit_logs').insert({
    actor_user_id: userId,
    subject_user_id: userId,
    action: 'checkout_created',
    ip: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent'),
    details: { checkoutId: data.id, amount, kind: 'web' },
  })

  return NextResponse.json({ checkoutId: data.id, donationUrl, message })
}

