// Push-ilmoitusten lähetys. Yksityinen VAPID-avain on vain täällä (Supabase Secrets),
// ei koskaan selaimessa.
//
// Toiminnot (POST, body.action):
//   test    kirjautunut käyttäjä lähettää itselleen testi-ilmoituksen kaikille laitteilleen
//   notify  sovellus kertoo tehneensä toiminnon (body.type, body.id). Ilmoitus lähtee
//           vain, jos tietokanta vahvistaa, että pyytäjä todella teki sen juuri nyt.
//   scheduled  tietokannan ajastus kerran tunnissa (pg_cron, otsake x-cron-secret).
//           Suomen ajan mukaan: haasteesta 2 pv jäljellä klo 18, haasteen tulos klo 9,
//           viikkoputki vaarassa lauantaina klo 12. dryRun palauttaa viestit lähettämättä.

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

// --------------------------------------------------------------- ajastetut

/** Suomen aika riippumatta palvelimen aikavyöhykkeestä. at vain kuivaharjoitukseen. */
function helsinki(at?: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Helsinki',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(at ? new Date(at) : new Date())
      .map((p) => [p.type, p.value]),
  )
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), weekday: parts.weekday }
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const joinNames = (names: string[]) =>
  names.length > 1 ? `${names.slice(0, -1).join(', ')} ja ${names.at(-1)}` : (names[0] ?? '')

interface Scored {
  userId: string
  name: string
  score: number
}

/** Haasteen hyväksyneet osallistujat tuloksineen, paras ensin. */
async function standings(challengeId: string, metric: string, from: string, to: string): Promise<Scored[]> {
  const { data: members } = await admin
    .from('challenge_members')
    .select('user_id')
    .eq('challenge_id', challengeId)
    .eq('status', 'accepted')
  const scored: Scored[] = []
  for (const member of members ?? []) {
    const { data: score } = await admin.rpc('challenge_score', {
      member: member.user_id,
      metric,
      from_date: from,
      to_date: to,
    })
    scored.push({ userId: member.user_id, name: await nameOf(member.user_id), score: score ?? 0 })
  }
  return scored.sort((a, b) => b.score - a.score)
}

interface Planned {
  userId: string
  preference: Preference
  message: Message
}

/** Haasteet, jotka päättyvät huomenna: 2 päivää jäljellä (sama kuin sovelluksessa). */
async function challengesEndingSoon(today: string): Promise<Planned[]> {
  const { data: challenges } = await admin
    .from('challenges')
    .select('id, metric, starts_on')
    .eq('ends_on', addDays(today, 1))
  const planned: Planned[] = []
  for (const c of challenges ?? []) {
    const ranked = await standings(c.id, c.metric, c.starts_on, today)
    const best = ranked[0]?.score ?? 0
    const leaders = ranked.filter((m) => m.score === best)
    for (const m of ranked) {
      const others = ranked.filter((o) => o.userId !== m.userId)
      let body: string
      if (best === 0) body = 'Kukaan ei ole vielä treenannut. Ehdit ottaa johdon!'
      else if (m.score === best && leaders.length > 1) body = `Tasapeli kärjessä (${best}). Ratkaise se!`
      else if (m.score === best) body = `Johdat: ${m.score}–${others[0]?.score ?? 0}. Pidä pintasi!`
      else body = `${joinNames(leaders.map((l) => l.name))} johtaa (${best}), sinulla ${m.score}. Vielä ehdit!`
      planned.push({
        userId: m.userId,
        preference: 'challenges',
        message: { title: `${CHALLENGES[c.metric] ?? 'Haaste'}: 2 päivää jäljellä`, body, url: '/kaverit', tag: `challenge-${c.id}` },
      })
    }
  }
  return planned
}

/** Eilen päättyneet haasteet: lopputulos. Tasapelissä voitto jaetaan, nollatuloksella ei voittajaa. */
async function challengeResults(today: string): Promise<Planned[]> {
  const yesterday = addDays(today, -1)
  const { data: challenges } = await admin.from('challenges').select('id, metric, starts_on').eq('ends_on', yesterday)
  const planned: Planned[] = []
  for (const c of challenges ?? []) {
    const ranked = await standings(c.id, c.metric, c.starts_on, yesterday)
    const best = ranked[0]?.score ?? 0
    const winners = best > 0 ? ranked.filter((m) => m.score === best) : []
    for (const m of ranked) {
      const won = winners.some((w) => w.userId === m.userId)
      let body: string
      if (!winners.length) body = 'Ei voittajaa tällä kertaa. Uusintaottelu?'
      else if (won && winners.length > 1) body = `Jaettu voitto! 🏆 (${best})`
      else if (won) body = `Sinä voitit! 🏆 (${best})`
      else body = `${joinNames(winners.map((w) => w.name))} voitti (${best}). Sinulla ${m.score}.`
      planned.push({
        userId: m.userId,
        preference: 'challenges',
        message: { title: `${CHALLENGES[c.metric] ?? 'Haaste'} päättyi`, body, url: '/kaverit', tag: `challenge-${c.id}` },
      })
    }
  }
  return planned
}

/** Viikkoputki vaarassa: viime viikolla vähintään 2 treeniä, tällä viikolla vielä alle 2. */
async function streakAtRisk(today: string): Promise<Planned[]> {
  const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7
  const monday = addDays(today, -weekday)
  const { data: subscriptions } = await admin.from('push_subscriptions').select('user_id')
  const users = [...new Set((subscriptions ?? []).map((s) => s.user_id))]
  const count = async (userId: string, from: string, to: string) => {
    const { count } = await admin
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .gte('date', from)
      .lte('date', to)
    return count ?? 0
  }
  const planned: Planned[] = []
  for (const userId of users) {
    const thisWeek = await count(userId, monday, today)
    if (thisWeek >= 2 || (await count(userId, addDays(monday, -7), addDays(monday, -1))) < 2) continue
    planned.push({
      userId,
      preference: 'streak',
      message: {
        title: 'Viikkoputki vaarassa',
        body: `Tällä viikolla ${thisWeek}/2 treeniä. Vielä ehdit! 💪`,
        url: '/',
        tag: 'streak',
      },
    })
  }
  return planned
}

async function scheduled(at: string | undefined, dryRun: boolean) {
  const now = helsinki(at)
  const planned = [
    ...(now.hour === 18 ? await challengesEndingSoon(now.date) : []),
    ...(now.hour === 9 ? await challengeResults(now.date) : []),
    ...(now.weekday === 'Sat' && now.hour === 12 ? await streakAtRisk(now.date) : []),
  ]
  const wanted = []
  for (const p of planned) if (await wants(p.userId, p.preference)) wanted.push(p)
  if (dryRun) return { now, planned: wanted.map((p) => p.message) }
  let sent = 0
  for (const p of wanted) sent += await sendTo(p.userId, p.message)
  return { now, sent }
}

/** Ajastuksen salaisuus on tietokannan Vaultissa: vain tietokannan herätys tuntee sen. */
async function assertCron(req: Request) {
  const { data } = await admin.rpc('push_cron_secret')
  if (!data || req.headers.get('x-cron-secret') !== data) throw new HttpError(401, 'Ei oikeutta.')
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
      case 'scheduled':
        await assertCron(req)
        return json(await scheduled(body.at, body.dryRun === true))
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
