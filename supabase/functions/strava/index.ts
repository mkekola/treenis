// Strava-yhteys palvelimella: client secret ja tokenit eivät koskaan käy
// selaimessa. Palvelin vain tuo aktiviteetit strava_activities-tauluun, ja
// sovellus yhdistää ne kirjattuihin treeneihin (src/lib/strava.ts).
//
// Toiminnot (POST, body.action):
//   start       kirjautunut käyttäjä aloittaa yhdistämisen → Stravan lupasivun osoite
//   callback    paluu Stravalta. Ei vaadi kirjautumista: iPhonen kotivalikko-
//               sovelluksessa paluu voi osua Safariin, joten käyttäjän kertoo state
//   import      hakee uudet aktiviteetit (sovellus kutsuu avattaessa)
//   disconnect  katkaisee yhteyden ja poistaa tuodut aktiviteetit
//
// Webhook: Strava vahvistaa tilauksen GET-pyynnöllä ja ilmoittaa muutoksista
// POST-pyynnöllä ilman actionia. Osoite on julkinen, joten ilmoituksen
// sisältöön ei luoteta: jokainen tapahtuma tarkistetaan Stravalta.

import { createClient } from 'npm:@supabase/supabase-js@2'

// Client ID on julkinen (näkyy Stravan lupasivun osoitteessa), joten se voi olla koodissa.
const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '296320'
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? ''
// Stravan API siirtyy osoitteeseen https://api-v3.strava.com 4.1.2027, joten osoitteet ovat asetuksia.
const API_BASE = Deno.env.get('STRAVA_API_BASE') ?? 'https://www.strava.com/api/v3'
const OAUTH_BASE = Deno.env.get('STRAVA_OAUTH_BASE') ?? 'https://www.strava.com/oauth'
const WEBHOOK_VERIFY_TOKEN = Deno.env.get('STRAVA_WEBHOOK_VERIFY_TOKEN') ?? ''

// Supabasen ajoympäristö: työ jatkuu vastauksen jälkeen. Strava odottaa vastausta kahdessa sekunnissa.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const ALLOWED_REDIRECTS = [/^https:\/\/treenis\.kekola\.fi\//, /^http:\/\/localhost:\d+\//]
const STATE_MAX_AGE_MS = 15 * 60 * 1000
/** Token uusitaan, jos se vanhenee tätä aiemmin. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000
/** Uusi tuonti hakee myös pari päivää taaksepäin, jotta myöhässä synkatut kellotreenit tulevat mukaan. */
const IMPORT_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000
const PAGE_SIZE = 200

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

// ------------------------------------------------------------------ yhdistäminen

async function start(userId: string, redirectUri: unknown) {
  if (typeof redirectUri !== 'string' || !ALLOWED_REDIRECTS.some((r) => r.test(redirectUri))) {
    throw new HttpError(400, 'Paluuosoite ei ole sallittu.')
  }
  const state = crypto.randomUUID()
  await admin.from('strava_oauth_states').delete().eq('user_id', userId)
  const { error } = await admin.from('strava_oauth_states').insert({ state, user_id: userId })
  if (error) throw error

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'auto',
    // read_all, koska salitreenit ovat Stravassa usein vain itselle näkyviä.
    scope: 'activity:read_all',
    state,
  })
  return { url: `${OAUTH_BASE}/authorize?${params}` }
}

async function callback(code: unknown, state: unknown, scope: unknown) {
  if (typeof code !== 'string' || typeof state !== 'string') throw new HttpError(400, 'Paluusta puuttuu tietoja.')

  const { data: row } = await admin.from('strava_oauth_states').select('*').eq('state', state).maybeSingle()
  await admin.from('strava_oauth_states').delete().eq('state', state)
  if (!row || Date.now() - Date.parse(row.created_at) > STATE_MAX_AGE_MS) {
    throw new HttpError(400, 'Yhdistämisen aloituksesta on kulunut liian kauan. Yritä uudelleen.')
  }
  if (typeof scope !== 'string' || !scope.includes('activity:read')) {
    throw new HttpError(400, 'Treenis tarvitsee luvan lukea aktiviteetit. Yritä uudelleen ja jätä ruutu valituksi.')
  }

  const tokens = await tokenRequest({ grant_type: 'authorization_code', code })
  const { error } = await admin.from('strava_connections').upsert({
    user_id: row.user_id,
    athlete_id: tokens.athlete.id,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: new Date(tokens.expires_at * 1000).toISOString(),
    scope,
    connected_at: new Date().toISOString(),
    last_import_at: null,
  })
  if (error) throw error

  return { connected: true, ...(await importFor(row.user_id)) }
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: 'POST',
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  })
  if (!res.ok) throw new HttpError(res.status === 400 || res.status === 401 ? 409 : 502, 'Strava ei hyväksynyt pyyntöä.')
  return await res.json()
}

/** Voimassa oleva token. Jos Strava ei enää uusi sitä, käyttäjä on perunut luvan. */
async function accessToken(userId: string): Promise<string | null> {
  const { data: conn } = await admin.from('strava_connections').select('*').eq('user_id', userId).maybeSingle()
  if (!conn) return null
  if (Date.parse(conn.expires_at) - Date.now() > REFRESH_MARGIN_MS) return conn.access_token

  try {
    const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: conn.refresh_token })
    await admin
      .from('strava_connections')
      .update({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: new Date(tokens.expires_at * 1000).toISOString(),
      })
      .eq('user_id', userId)
    return tokens.access_token
  } catch (e) {
    if (e instanceof HttpError && e.status === 409) {
      await forget(userId)
      return null
    }
    throw e
  }
}

// ---------------------------------------------------------------------- tuonti

interface StravaSummary {
  id: number
  name: string
  sport_type?: string
  type?: string
  start_date: string
  elapsed_time: number
  moving_time?: number
  distance?: number
  average_heartrate?: number
  max_heartrate?: number
  calories?: number
  total_elevation_gain?: number
}

function rowOf(userId: string, a: StravaSummary, now: string) {
  const round = (v?: number) => (v ? Math.round(v) : null)
  return {
    user_id: userId,
    id: a.id,
    sport_type: a.sport_type ?? a.type ?? 'Workout',
    name: a.name,
    started_at: a.start_date,
    elapsed_sec: a.elapsed_time,
    moving_sec: a.moving_time ?? null,
    distance_m: a.distance || null,
    avg_hr: round(a.average_heartrate),
    max_hr: round(a.max_heartrate),
    calories: round(a.calories),
    elevation_gain_m: a.total_elevation_gain || null,
    updated_at: now,
    deleted_at: null,
  }
}

async function importFor(userId: string) {
  const token = await accessToken(userId)
  if (!token) return { connected: false, imported: 0 }

  const { data: conn } = await admin.from('strava_connections').select('last_import_at').eq('user_id', userId).single()
  // Ensimmäinen tuonti hakee kuluvan vuoden.
  const from = conn?.last_import_at
    ? Date.parse(conn.last_import_at) - IMPORT_OVERLAP_MS
    : Date.UTC(new Date().getUTCFullYear(), 0, 1) - 3 * 60 * 60 * 1000
  const startedAt = new Date().toISOString()

  let imported = 0
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({ after: String(Math.floor(from / 1000)), per_page: String(PAGE_SIZE), page: String(page) })
    const res = await fetch(`${API_BASE}/athlete/activities?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 429) throw new HttpError(429, 'Stravan käyttöraja täyttyi. Yritä vartin päästä uudelleen.')
    if (!res.ok) throw new HttpError(502, 'Aktiviteettien haku Stravasta epäonnistui.')
    const activities = (await res.json()) as StravaSummary[]
    if (activities.length) {
      const now = new Date().toISOString()
      const { error } = await admin.from('strava_activities').upsert(activities.map((a) => rowOf(userId, a, now)))
      if (error) throw error
      imported += activities.length
    }
    if (activities.length < PAGE_SIZE) break
  }

  await admin.from('strava_connections').update({ last_import_at: startedAt }).eq('user_id', userId)
  return { connected: true, imported }
}

// ----------------------------------------------------------------- katkaisu

/** Poistaa yhteyden ja tuodut aktiviteetit. Päiväkirjan treenit jäävät. */
async function forget(userId: string) {
  await admin.from('strava_connections').delete().eq('user_id', userId)
  await admin.from('strava_activities').delete().eq('user_id', userId)
}

async function disconnect(userId: string) {
  const token = await accessToken(userId)
  if (token) {
    await fetch(`${OAUTH_BASE}/deauthorize`, { method: 'POST', body: new URLSearchParams({ access_token: token }) }).catch(
      () => undefined,
    )
  }
  await forget(userId)
  return { connected: false }
}

// ---------------------------------------------------------------------- webhook

/** Stravan tilausvahvistus: vastataan haasteeseen, jos tunniste täsmää. */
function verifySubscription(url: URL): Response {
  const ok =
    url.searchParams.get('hub.mode') === 'subscribe' &&
    WEBHOOK_VERIFY_TOKEN !== '' &&
    url.searchParams.get('hub.verify_token') === WEBHOOK_VERIFY_TOKEN
  if (!ok) return json({ error: 'Tuntematon tilaus.' }, 403)
  return json({ 'hub.challenge': url.searchParams.get('hub.challenge') })
}

interface WebhookEvent {
  object_type: 'activity' | 'athlete'
  object_id: number
  aspect_type: 'create' | 'update' | 'delete'
  owner_id: number
}

async function handleEvent(event: WebhookEvent) {
  const { data: conn } = await admin
    .from('strava_connections')
    .select('user_id')
    .eq('athlete_id', event.owner_id)
    .maybeSingle()
  if (!conn) return
  const token = await accessToken(conn.user_id)
  if (!token) return

  // Luvan perumisesta kertova ilmoitus: varmistetaan kysymällä Stravalta itseltään.
  if (event.object_type === 'athlete') {
    const res = await fetch(`${API_BASE}/athlete`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.status === 401) await forget(conn.user_id)
    return
  }

  const res = await fetch(`${API_BASE}/activities/${event.object_id}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const now = new Date().toISOString()
  if (res.status === 404) {
    // Aktiviteettia ei enää ole: merkitään poistetuksi, jotta sovellus siivoaa oman merkintänsä.
    await admin
      .from('strava_activities')
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', conn.user_id)
      .eq('id', event.object_id)
    return
  }
  if (!res.ok) return
  const activity = (await res.json()) as StravaSummary
  await admin.from('strava_activities').upsert(rowOf(conn.user_id, activity, now))
}

// ---------------------------------------------------------------------- reititys

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method === 'GET') return verifySubscription(new URL(req.url))
  if (req.method !== 'POST') return json({ error: 'Tuntematon pyyntö.' }, 405)

  const body = await req.json().catch(() => ({}))
  if (body.action === undefined && body.aspect_type) {
    EdgeRuntime.waitUntil(handleEvent(body as WebhookEvent).catch((e) => console.error(e)))
    return json({ ok: true })
  }
  try {
    switch (body.action) {
      case 'start':
        return json(await start(await userIdOf(req), body.redirectUri))
      case 'callback':
        return json(await callback(body.code, body.state, body.scope))
      case 'import':
        return json(await importFor(await userIdOf(req)))
      case 'disconnect':
        return json(await disconnect(await userIdOf(req)))
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
