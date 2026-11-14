// Push-ilmoitusten lähetys. Yksityinen VAPID-avain on vain täällä (Supabase Secrets),
// ei koskaan selaimessa.
//
// Toiminnot (POST, body.action):
//   test    kirjautunut käyttäjä lähettää itselleen testi-ilmoituksen kaikille laitteilleen
//   notify  sovellus kertoo tehneensä toiminnon (body.type, body.id). Ilmoitus lähtee
//           vain, jos tietokanta vahvistaa, että pyytäjä todella teki sen juuri nyt.
//
// Ajastetut muistutukset tulevat myöhemmin.

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

// ------------------------------------------------------------------ tapahtumat

type Preference = 'friend_requests' | 'reactions' | 'challenges' | 'streak'

/** Asetusriviä ei ole ennen käyttöönottoa, jolloin kaikki on päällä (Marian päätös). */
async function wants(userId: string, preference: Preference): Promise<boolean> {
  const { data } = await admin.from('notification_settings').select(preference).eq('user_id', userId).maybeSingle()
  return data ? (data as Record<Preference, boolean>)[preference] : true
}

async function nameOf(userId: string): Promise<string> {
  const { data } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  return data?.display_name || 'Kaveri'
}

const REACTIONS: Record<string, string> = {
  party: '🎉',
  clap: '👏',
  heart: '❤️',
  hundred: '💯',
  trophy: '🏆',
  fire: '🔥',
  hot: '🥵',
}

const CHALLENGES: Record<string, string> = { strength: 'Salihaaste', workouts: 'Treenihaaste', weeks: 'Viikkoputkihaaste' }

/** Vain tuoreet tapahtumat: vanhaa toimintoa ei voi käyttää ilmoitusten lähettämiseen. */
const FRESH_MS = 5 * 60 * 1000
const fresh = (iso: string | null | undefined) => !!iso && Date.now() - Date.parse(iso) < FRESH_MS

async function notify(actor: string, type: string, id: string | undefined): Promise<number> {
  const actorName = await nameOf(actor)
  switch (type) {
    // Lähetetty kaveripyyntö: uusin oma odottava pyyntö.
    case 'friend_request': {
      const { data } = await admin
        .from('friendships')
        .select('addressee, created_at')
        .eq('requester', actor)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (!data || !fresh(data.created_at) || !(await wants(data.addressee, 'friend_requests'))) return 0
      return sendTo(data.addressee, {
        title: 'Kaveripyyntö',
        body: `${actorName} haluaa kaveriksi Treeniksessä.`,
        url: '/kaverit',
        tag: `friend-${actor}`,
      })
    }
    // Hyväksytty pyyntö: hyväksyjä on aina pyynnön vastaanottaja.
    case 'friend_accepted': {
      const query = admin.from('friendships').select('requester, accepted_at').eq('addressee', actor).eq('status', 'accepted')
      const { data } = await (id ? query.eq('id', id) : query.order('accepted_at', { ascending: false }).limit(1)).maybeSingle()
      if (!data || !fresh(data.accepted_at) || !(await wants(data.requester, 'friend_requests'))) return 0
      return sendTo(data.requester, {
        title: 'Uusi kaveri 🎉',
        body: `${actorName} hyväksyi kaveripyyntösi.`,
        url: '/kaverit',
        tag: `friend-${actor}`,
      })
    }
    case 'reaction': {
      const { data: reaction } = await admin
        .from('reactions')
        .select('reaction, created_at')
        .eq('workout_id', id)
        .eq('user_id', actor)
        .maybeSingle()
      if (!reaction || !fresh(reaction.created_at)) return 0
      const { data: workout } = await admin.from('workouts').select('user_id, title').eq('id', id).maybeSingle()
      if (!workout || workout.user_id === actor || !(await wants(workout.user_id, 'reactions'))) return 0
      return sendTo(workout.user_id, {
        title: `${actorName} ${REACTIONS[reaction.reaction] ?? ''}`.trim(),
        body: `Reagoi treeniisi: ${workout.title}`,
        url: '/kaverit',
        tag: `reaction-${id}-${actor}`,
      })
    }
    // Haastekutsu kaikille kutsutuille, jotka eivät ole vielä vastanneet.
    case 'challenge_invite': {
      const { data: challenge } = await admin
        .from('challenges')
        .select('creator, metric, created_at')
        .eq('id', id)
        .maybeSingle()
      if (!challenge || challenge.creator !== actor || !fresh(challenge.created_at)) return 0
      const { data: invited } = await admin
        .from('challenge_members')
        .select('user_id')
        .eq('challenge_id', id)
        .eq('status', 'invited')
      let sent = 0
      for (const member of invited ?? []) {
        if (!(await wants(member.user_id, 'challenges'))) continue
        sent += await sendTo(member.user_id, {
          title: 'Haaste! 🏆',
          body: `${actorName} haastoi sinut: ${CHALLENGES[challenge.metric] ?? 'haaste'}`,
          url: '/kaverit',
          tag: `challenge-${id}`,
        })
      }
      return sent
    }
    default:
      throw new HttpError(400, 'Tuntematon tapahtuma.')
  }
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
      case 'notify':
        return json({ sent: await notify(await userIdOf(req), String(body.type), body.id) })
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
