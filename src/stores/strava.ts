import { FunctionsHttpError } from '@supabase/supabase-js'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db, plain } from '@/db'
import { reconcile, type StravaActivity } from '@/lib/strava'
import { supabase } from '@/lib/supabase'
import { stravaActivityFromRow, type StravaActivityRow } from '@/lib/sync'
import { useWorkouts } from '@/stores/workouts'

const LAST_PULL_KEY = 'treenis.stravaLastPull'
/** Stravaa ei kysytä joka synkassa: webhook tuo uudet, tämä on varmistus. */
const IMPORT_INTERVAL_MS = 5 * 60 * 1000

function readLastPull(): string | null {
  try {
    return localStorage.getItem(LAST_PULL_KEY)
  } catch {
    return null
  }
}

function writeLastPull(value: string | null) {
  try {
    if (value) localStorage.setItem(LAST_PULL_KEY, value)
    else localStorage.removeItem(LAST_PULL_KEY)
  } catch {
    // Ilman tallennustilaa haetaan seuraavalla kerralla kaikki, mikä on vain hitaampaa.
  }
}

/** Palvelimen virheviesti on suomeksi vastauksen rungossa. */
async function messageOf(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.json().catch(() => null)
    if (body?.error) return body.error
  }
  return 'Stravaan ei saatu yhteyttä. Yritä hetken päästä uudelleen.'
}

/**
 * Strava-yhteys. Palvelin (supabase/functions/strava) hoitaa tokenit ja tuo
 * aktiviteetit, ja tämä store hakee ne laitteelle ja sovittaa treeneihin.
 */
export const useStrava = defineStore('strava', () => {
  const workouts = useWorkouts()
  const connectedAt = ref<string | null>(null)
  const lastImportAt = ref<string | null>(null)
  const connected = computed(() => connectedAt.value !== null)
  let lastImportCall = 0

  async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await supabase.functions.invoke('strava', { body: { action, ...extra } })
    if (error) throw new Error(await messageOf(error))
    return data as T
  }

  async function loadStatus() {
    const { data, error } = await supabase.rpc('strava_status')
    if (error) throw error
    const row = (data as { connected_at: string; last_import_at: string | null }[] | null)?.[0]
    connectedAt.value = row?.connected_at ?? null
    lastImportAt.value = row?.last_import_at ?? null
  }

  /** Siirtyy Stravan lupasivulle. Paluu tulee sivulle /strava. */
  async function connect() {
    const { url } = await call<{ url: string }>('start', { redirectUri: `${location.origin}/strava` })
    location.assign(url)
  }

  function finishConnect(code: string, state: string, scope: string) {
    return call<{ connected: boolean; imported: number }>('callback', { code, state, scope })
  }

  async function disconnect() {
    await call('disconnect')
    connectedAt.value = null
    lastImportAt.value = null
    await db.stravaActivities.clear()
    writeLastPull(null)
  }

  async function importNow() {
    lastImportCall = Date.now()
    await call('import')
    await loadStatus()
  }

  /** Uudet ja muuttuneet aktiviteetit palvelimelta laitteelle. Poistetut sovitetaan heti. */
  async function pull() {
    const since = readLastPull()
    let query = supabase.from('strava_activities').select('*').order('updated_at')
    if (since) query = query.gt('updated_at', since)
    const { data, error } = await query
    if (error) throw error
    const rows = (data ?? []) as StravaActivityRow[]

    for (const row of rows) {
      const activity = stravaActivityFromRow(row)
      if (row.deleted_at) {
        await db.stravaActivities.delete(activity.id)
        await apply(activity, true)
      } else {
        await db.stravaActivities.put(plain(activity))
      }
    }
    if (rows.length) writeLastPull(rows[rows.length - 1].updated_at)
  }

  async function apply(activity: StravaActivity, deleted = false): Promise<boolean> {
    const { save, remove } = reconcile(activity, workouts.workouts, deleted)
    for (const workout of save) await workouts.save(workout)
    for (const id of remove) await workouts.remove(id)
    return save.length + remove.length > 0
  }

  /**
   * Synkan osa: tuonti harvakseltaan, uudet aktiviteetit laitteelle ja
   * sovitus treeneihin. Palauttaa true, jos treenejä muuttui ja ne pitää lähettää.
   */
  async function sync(): Promise<boolean> {
    await loadStatus()
    if (connected.value && Date.now() - lastImportCall > IMPORT_INTERVAL_MS) {
      // Epäonnistunut tuonti ei estä jo tuotujen sovittamista.
      await importNow().catch(() => undefined)
    }
    await pull()

    const activities = (await db.stravaActivities.toArray()).sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    let changed = false
    for (const activity of activities) changed = (await apply(activity)) || changed
    return changed
  }

  return { connected, connectedAt, lastImportAt, loadStatus, connect, finishConnect, disconnect, importNow, sync }
})
