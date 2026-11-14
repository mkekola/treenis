// Push-ilmoitusten lähetys. Yksityinen VAPID-avain on vain täällä (Supabase Secrets),
// ei koskaan selaimessa.
//
// Toiminnot (POST, body.action):
//   test   kirjautunut käyttäjä lähettää itselleen testi-ilmoituksen kaikille laitteilleen
//
// Tapahtumat (kaveripyyntö, reaktio, haaste) ja ajastetut muistutukset tulevat myöhemmin.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? '',
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
)

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}

async function userIdOf(req: Request): Promise<string> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '')
  const { data } = token ? await admin.auth.getUser(token) : { data: { user: null } }
  if (!data.user) throw new HttpError(401, 'Kirjaudu ensin sisään.')
  return data.user.id
}

/** Sama muoto, jonka public/push-sw.js näyttää. */
interface Message {
  title: string
  body: string
  url?: string
  /** Sama tag korvaa edellisen ilmoituksen, esim. saman haasteen muistutukset. */
  tag?: string
}

/**
 * Lähettää viestin käyttäjän kaikille laitteille. Ilmoituspalvelu vastaa 404 tai 410,
 * kun tilaus on vanhentunut (sovellus poistettu, lupa peruttu): sellainen poistetaan.
 */
async function sendTo(userId: string, message: Message): Promise<number> {
  const { data: subscriptions, error } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId)
  if (error) throw error
  let sent = 0
  for (const sub of subscriptions ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(message),
        { TTL: 60 * 60 * 24 },
      )
      sent++
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      } else {
        console.error('Ilmoitus ei lähtenyt', status, e)
      }
    }
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Tuntematon pyyntö.' }, 405)

  const body = await req.json().catch(() => ({}))
  try {
    switch (body.action) {
      case 'test': {
        const sent = await sendTo(await userIdOf(req), {
          title: 'Treenis',
          body: 'Ilmoitukset toimivat! 💪',
          url: '/asetukset/ulkoasu',
          tag: 'test',
        })
        return json({ sent })
      }
      default:
        return json({ error: 'Tuntematon toiminto.' }, 400)
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500
    const message = e instanceof HttpError ? e.message : 'Jokin meni vikaan palvelimella.'
    if (!(e instanceof HttpError)) console.error(e)
    return json({ error: message }, status)
  }
})
