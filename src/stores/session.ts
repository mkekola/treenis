import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db, plain } from '@/db'
import { applyDeviations, keepDeviations, pruneKept, type Deviation } from '@/lib/deviation'
import * as logic from '@/lib/session'
import { useExercises } from '@/stores/exercises'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'
import type { ActiveSession, SetRef } from '@/types/session'
import type { Feel, SetEntry, WorkoutTemplate } from '@/types/workout'

const KEY = 'current'

/** Lisätyn liikkeen oletus, kun pohjaa ei ole. Sarjojen toistot ja määrä muutetaan rivillä. */
const DEFAULT_SETS = 3
const DEFAULT_REPS = 10
const DEFAULT_REST_SEC = 90

/**
 * Käynnissä oleva treeni. Tila tallennetaan tietokantaan jokaisen muutoksen
 * jälkeen, joten treeni säilyy kun puhelin menee lukkoon tai sovellus
 * suljetaan. Itse logiikka on lib/session.ts:ssä puhtaina funktioina.
 */
export const useSession = defineStore('session', () => {
  const active = ref<ActiveSession | null>(null)
  const exercises = useExercises()
  const workouts = useWorkouts()
  const templates = useTemplates()

  async function load() {
    const record = await db.activeSession.get(KEY)
    active.value = record?.session ?? null
  }

  async function apply(next: ActiveSession) {
    active.value = next
    await db.activeSession.put({ id: KEY, session: plain(next) })
  }

  function update(change: (session: ActiveSession) => ActiveSession) {
    if (!active.value) return Promise.resolve()
    return apply(change(active.value))
  }

  async function start(template?: WorkoutTemplate) {
    await apply(
      logic.buildSession({
        id: crypto.randomUUID(),
        now: new Date(),
        template,
        history: workouts.workouts,
        exercises: (id) => exercises.byId.get(id),
      }),
    )
  }

  /** Rakentaa liikkeen sen omasta historiasta: tuttu liike saa viimeisen painonsa, uusi tyhjän. */
  function buildFor(exerciseId: string, sets: number, reps: number) {
    const exercise = exercises.byId.get(exerciseId)
    if (!exercise) return null
    return logic.newSessionExercise({
      exercise,
      sets,
      reps,
      history: workouts.workouts,
      lookup: (id) => exercises.byId.get(id),
    })
  }

  /** Vaihtaa liikkeen, ja uusi liike perii sarjamäärän ja tavoitetoistot. */
  async function swapExercise(block: number, exercise: number, exerciseId: string) {
    const current = active.value?.blocks[block]?.exercises[exercise]
    if (!current) return
    const replacement = buildFor(exerciseId, current.target.sets, current.target.reps)
    if (replacement) await update((s) => logic.swapExercise(s, block, exercise, replacement))
  }

  async function addExercise(exerciseId: string) {
    const built = buildFor(exerciseId, DEFAULT_SETS, DEFAULT_REPS)
    if (!built) return
    const restSec = active.value?.blocks.at(-1)?.restSec ?? DEFAULT_REST_SEC
    await update((s) => logic.addBlock(s, crypto.randomUUID(), restSec, built))
  }

  const setValues = (ref: SetRef, values: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'durationSec'>>) =>
    update((s) => logic.setValues(s, ref, values))
  const completeSet = (ref: SetRef) => update((s) => logic.completeSet(s, ref, new Date()))
  const uncompleteSet = (ref: SetRef) => update((s) => logic.uncompleteSet(s, ref, new Date()))
  const addSet = (block: number, exercise: number) => update((s) => logic.addSet(s, block, exercise))
  const removeLastSet = (block: number, exercise: number) =>
    update((s) => logic.removeLastSet(s, block, exercise))
  const setFeel = (block: number, exercise: number, feel: Feel | 'skip') =>
    update((s) => logic.setFeel(s, block, exercise, feel))
  const setNotes = (notes: string) => update((s) => logic.setNotes(s, notes))
  const skipRest = () => update((s) => logic.skipRest(s))
  const goToBlock = (index: number) => update((s) => logic.setCurrentBlock(s, index))

  async function discard() {
    active.value = null
    await db.activeSession.delete(KEY)
  }

  /**
   * Tallentaa valmiin treenin ja poistaa käynnissä olevan. Treeni tallennetaan
   * ensin: jos sovellus kaatuu näiden välissä, sessio palautetaan ja sen voi
   * päättää uudelleen, ja sama tunniste estää tuplan.
   */
  async function finish(): Promise<string | null> {
    const session = active.value
    if (!session) return null

    const workout = logic.toWorkout(session, new Date())
    await workouts.save(workout)

    const template = templates.templates.find((t) => t.id === session.templateId)
    if (template) await templates.save({ ...pruneKept(template, workout), lastUsedAt: workout.logged?.startedAt })

    await discard()
    return workout.id
  }

  /** Toistuneet poikkeamat yhteenvedosta: päivitä pohja tai pidä se ennallaan. */
  async function updateTemplate(deviations: Deviation[]) {
    const template = templates.templates.find((t) => t.id === active.value?.templateId)
    if (template) await templates.save(applyDeviations(template, deviations, () => crypto.randomUUID()))
  }

  async function keepTemplate(deviations: Deviation[]) {
    const template = templates.templates.find((t) => t.id === active.value?.templateId)
    if (template) await templates.save(keepDeviations(template, deviations))
  }

  /** Keskeytyneen treenin kuvaus palautuskorttia varten. */
  const recovery = computed(() => {
    const session = active.value
    if (!session) return null
    return { title: session.title, startedAt: session.startedAt, ...logic.progress(session) }
  })

  return {
    active,
    recovery,
    load,
    start,
    setValues,
    completeSet,
    uncompleteSet,
    addSet,
    swapExercise,
    addExercise,
    removeLastSet,
    setFeel,
    setNotes,
    skipRest,
    goToBlock,
    discard,
    finish,
    updateTemplate,
    keepTemplate,
  }
})
