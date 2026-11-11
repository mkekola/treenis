import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, type OutboxRecord } from '@/db'
import { supabase } from '@/lib/supabase'
import {
  exerciseFromRow,
  exerciseToRow,
  latestUpdate,
  programFromRow,
  programToRow,
  pushAll,
  remoteAction,
  templateFromRow,
  templateToRow,
  toLocal,
  type ExerciseRow,
  type ProgramRow,
  type RemoteWorkout,
  type TemplateRow,
} from '@/lib/sync'
import { useExercises } from '@/stores/exercises'
import { usePrograms } from '@/stores/programs'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'

const LAST_PULL_KEY = 'treenis.lastPull'

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
  } catch {
    // Ilman muistia seuraava haku hakee kaiken, mikä on hitaampaa mutta oikein.
  }
}

/**
 * Laitteen ja Supabasen välinen synkka. Ensin lähetetään laitteen omat
 * muutokset, sitten haetaan muilta laitteilta tulleet. Ilman verkkoa tai
 * voimassa olevaa istuntoa synkka vain odottaa seuraavaa kertaa.
 */
export const useSync = defineStore('sync', () => {
  const workouts = useWorkouts()
  const templates = useTemplates()
  const exercises = useExercises()
  const programs = usePrograms()
  const state = ref<'idle' | 'syncing' | 'offline' | 'error'>('idle')
  /** Laitteella olevat muutokset (treenit, pohjat, ohjelmat, omat liikkeet), joita ei ole vielä lähetetty. */
  const pending = ref(0)

  async function countPending() {
    pending.value = await db.outbox.count()
  }

  let running: Promise<void> | null = null
  let again = false

  /** Lähettää yhden rivin. Palauttaa false, jos palvelimella oli uudempi versio. */
  async function send(entry: OutboxRecord, userId: string): Promise<boolean> {
    if (entry.kind === 'program') {
      const program = await db.programs.get(entry.id)
      if (!program) return true
      const { error } = await supabase.from('programs').upsert({ ...programToRow(program), user_id: userId })
      if (error) throw error
      return true
    }
    if (entry.kind === 'template') {
      const template = await db.templates.get(entry.id)
      if (!template) return true
      const { error } = await supabase
        .from('templates')
        .upsert({ ...templateToRow(template), user_id: userId })
      if (error) throw error
      return true
    }
    if (entry.kind === 'exercise') {
      const exercise = await db.customExercises.get(entry.id)
      if (!exercise) return true
      const { error } = await supabase
        .from('custom_exercises')
        .upsert({ ...exerciseToRow(exercise), user_id: userId, deleted_at: null })
      if (error) throw error
      return true
    }
    const workout = await db.workouts.get(entry.id)
    if (!workout) return true
    const { data, error } = await supabase.rpc('save_workout', { payload: workout })
    if (error) throw error
    return data !== false
  }

  /** Lähettää jonon. Rivi poistetaan jonosta vain, jos se ei muuttunut lähetyksen aikana. */
  async function push(userId: string) {
    return pushAll(
      await db.outbox.toArray(),
      (entry) => send(entry, userId),
      (entry) =>
        db.transaction('rw', db.outbox, async () => {
          const current = await db.outbox.get(entry.id)
          if (current?.updatedAt === entry.updatedAt) await db.outbox.delete(entry.id)
        }),
      () => !navigator.onLine,
    )
  }

  async function isPending(id: string) {
    return (await db.outbox.get(id)) !== undefined
  }

  async function pullWorkouts(since: string | null) {
    const { data, error } = await supabase.rpc('get_workouts', { since })
    if (error) throw error
    const remotes = (data ?? []) as RemoteWorkout[]
    for (const remote of remotes) {
      const action = remoteAction(remote, await db.workouts.get(remote.id), await isPending(remote.id))
      if (action === 'put') await workouts.applyRemote(toLocal(remote))
      else if (action === 'delete') await workouts.removeLocal(remote.id)
    }
    writeLastPull(latestUpdate(remotes, since))
  }

  // Pohjia ja omia liikkeitä on vain kymmeniä, joten ne haetaan aina kaikki.
  async function pullTemplates() {
    const { data, error } = await supabase.from('templates').select('*')
    if (error) throw error
    for (const remote of (data as TemplateRow[]).map(templateFromRow)) {
      const action = remoteAction(remote, await db.templates.get(remote.id), await isPending(remote.id))
      if (action === 'put') await templates.applyRemote(toLocal(remote))
      else if (action === 'delete') await templates.removeLocal(remote.id)
    }
  }

  async function pullPrograms() {
    const { data, error } = await supabase.from('programs').select('*')
    if (error) throw error
    for (const remote of (data as ProgramRow[]).map(programFromRow)) {
      const action = remoteAction(remote, await db.programs.get(remote.id), await isPending(remote.id))
      if (action === 'put') await programs.applyRemote(toLocal(remote))
      else if (action === 'delete') await programs.removeLocal(remote.id)
    }
  }

  async function pullExercises() {
    const { data, error } = await supabase.from('custom_exercises').select('*')
    if (error) throw error
    for (const remote of (data as ExerciseRow[]).map(exerciseFromRow)) {
      const action = remoteAction(
        remote,
        await db.customExercises.get(remote.id),
        await isPending(remote.id),
      )
      if (action === 'put') await exercises.applyRemote(toLocal(remote))
      else if (action === 'delete') await exercises.removeLocal(remote.id)
    }
  }

  async function once() {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      state.value = 'offline'
      await countPending()
      return
    }
    state.value = 'syncing'
    try {
      const { serverWasNewer, failed } = await push(data.session.user.id)
      // Jos palvelimella oli uudempi treeni, haetaan kaikki: se on voitu jo
      // ohittaa aiemmassa haussa, kun oma muutos odotti jonossa.
      await pullWorkouts(serverWasNewer ? null : readLastPull())
      await pullTemplates()
      await pullPrograms()
      await pullExercises()
      state.value = failed > 0 ? 'error' : 'idle'
    } catch {
      // Jono säilyy, joten mitään ei menetetä: seuraava ajo yrittää uudelleen.
      state.value = navigator.onLine ? 'error' : 'offline'
    } finally {
      await countPending()
    }
  }

  /** Pyynnöt eivät aja päällekkäin: kesken olevan perään ajetaan yksi kierros lisää. */
  function run(): Promise<void> {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        await once()
      } while (again)
      running = null
    })()
    return running
  }

  /** Synkka käynnistyy, kun treeni tallennetaan, verkko palaa tai sovellus tulee esiin. */
  function start() {
    workouts.$onAction(({ name, after }) => {
      if (name === 'save') after(() => void run())
    })
    templates.$onAction(({ name, after }) => {
      if (name === 'save') after(() => void run())
    })
    programs.$onAction(({ name, after }) => {
      if (name === 'save') after(() => void run())
    })
    window.addEventListener('online', () => void run())
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void run()
    })
    // Supabasen ohje: kuuntelijan sisältä ei kutsuta Supabasea suoraan, koska
    // kirjautumisen lukko on vielä kiinni. Ajo siirretään seuraavaan kierrokseen.
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') setTimeout(() => void run(), 0)
    })
    void run()
  }

  return { state, pending, run, start }
})
