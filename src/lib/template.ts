import { defaultSets } from '@/lib/session'
import type { ActiveSession } from '@/types/session'
import type { Block, BlockExercise, Exercise, Measurement, WorkoutTemplate } from '@/types/workout'

/**
 * Pohjan muokkaus. Kuten sessiossa, jokainen toiminto palauttaa uuden pohjan
 * vanhaa muuttamatta, joten logiikan voi testata ilman käyttöliittymää.
 *
 * Pohjan sarjat ovat tavoitteita: liikkeen kaikilla sarjoilla on sama
 * toistomäärä (tai aikaliikkeellä kesto), ja done on aina false.
 */

/** Liikkeen paikka pohjassa: lohko ja liike lohkon sisällä. */
export interface ExerciseRef {
  block: number
  exercise: number
}

export const DEFAULT_SETS = 3
export const DEFAULT_REPS = 10
export const DEFAULT_REST_SEC = 90
export const MAX_SETS = 10

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function newTemplate(id: string, name: string): WorkoutTemplate {
  return { id, name, blocks: [] }
}

export function rename(template: WorkoutTemplate, name: string): WorkoutTemplate {
  return { ...clone(template), name }
}

/** Uusi liike tulee loppuun omaksi lohkokseen. Supersarjaksi sen voi yhdistää jälkikäteen. */
export function addExercise(template: WorkoutTemplate, blockId: string, exercise: Exercise): WorkoutTemplate {
  const next = clone(template)
  next.blocks.push({
    id: blockId,
    restSec: DEFAULT_REST_SEC,
    exercises: [{ exerciseId: exercise.id, sets: defaultSets(exercise.measurement, DEFAULT_SETS, DEFAULT_REPS) }],
  })
  return next
}

/** Tavoite luettuna pohjasta: sarjojen määrä ja ensimmäisen sarjan arvo. */
export function targetOf(entry: BlockExercise): { sets: number; reps?: number; durationSec?: number } {
  const first = entry.sets[0]
  return { sets: entry.sets.length, reps: first?.reps, durationSec: first?.durationSec }
}

/** Muuttaa sarjamäärää tai toistoja (aikaliikkeellä kestoa). Kaikki sarjat saavat saman arvon. */
export function setTarget(
  template: WorkoutTemplate,
  at: ExerciseRef,
  measurement: Measurement,
  change: { sets?: number; value?: number },
): WorkoutTemplate {
  const next = clone(template)
  const entry = next.blocks[at.block].exercises[at.exercise]
  const current = targetOf(entry)
  const count = Math.min(MAX_SETS, Math.max(1, Math.round(change.sets ?? current.sets)))
  const value = Math.max(1, Math.round(change.value ?? (measurement === 'time' ? current.durationSec : current.reps) ?? 1))
  entry.sets = Array.from({ length: count }, () =>
    measurement === 'time' ? { durationSec: value, done: false } : { reps: value, done: false },
  )
  return next
}

export function setRest(template: WorkoutTemplate, block: number, restSec: number): WorkoutTemplate {
  const next = clone(template)
  next.blocks[block].restSec = Math.max(0, Math.round(restSec))
  return next
}

/** Poistaa liikkeen. Tyhjäksi jäänyt lohko poistuu samalla. */
export function removeExercise(template: WorkoutTemplate, at: ExerciseRef): WorkoutTemplate {
  const next = clone(template)
  const block = next.blocks[at.block]
  block.exercises.splice(at.exercise, 1)
  if (block.exercises.length === 0) next.blocks.splice(at.block, 1)
  return next
}

/**
 * Siirtää liikettä ylös (-1) tai alas (+1). Supersarjan sisällä liike vaihtaa
 * paikkaa toisen liikkeen kanssa. Lohkon reunalla siirtyy koko lohko, jotta
 * supersarja ei hajoa vahingossa: erottaminen on oma toimintonsa.
 */
export function canMove(template: WorkoutTemplate, at: ExerciseRef, direction: -1 | 1): boolean {
  const size = template.blocks[at.block].exercises.length
  const inside = at.exercise + direction
  if (inside >= 0 && inside < size) return true
  const target = at.block + direction
  return target >= 0 && target < template.blocks.length
}

export function move(template: WorkoutTemplate, at: ExerciseRef, direction: -1 | 1): WorkoutTemplate {
  if (!canMove(template, at, direction)) return template
  const next = clone(template)
  const exercises = next.blocks[at.block].exercises
  const inside = at.exercise + direction
  if (inside >= 0 && inside < exercises.length) {
    ;[exercises[at.exercise], exercises[inside]] = [exercises[inside], exercises[at.exercise]]
    return next
  }
  const target = at.block + direction
  ;[next.blocks[at.block], next.blocks[target]] = [next.blocks[target], next.blocks[at.block]]
  return next
}

/** Lohkon voi yhdistää edelliseen, jos sellainen on. */
export function canJoin(template: WorkoutTemplate, block: number): boolean {
  return block > 0 && block < template.blocks.length
}

/**
 * Yhdistää lohkon edelliseen supersarjaksi. Lepo tulee edellisestä lohkosta,
 * koska supersarjassa levätään vasta kierroksen lopussa.
 */
export function joinWithPrevious(template: WorkoutTemplate, block: number): WorkoutTemplate {
  if (!canJoin(template, block)) return template
  const next = clone(template)
  const [joined] = next.blocks.splice(block, 1)
  next.blocks[block - 1].exercises.push(...joined.exercises)
  return next
}

/** Erottaa liikkeen supersarjasta omaksi lohkokseen heti supersarjan perään. */
export function detach(template: WorkoutTemplate, at: ExerciseRef, blockId: string): WorkoutTemplate {
  const source = template.blocks[at.block]
  if (source.exercises.length < 2) return template
  const next = clone(template)
  const [entry] = next.blocks[at.block].exercises.splice(at.exercise, 1)
  const block: Block = { id: blockId, restSec: source.restSec, exercises: [entry] }
  next.blocks.splice(at.block + 1, 0, block)
  return next
}

export function exerciseCount(template: WorkoutTemplate): number {
  return template.blocks.reduce((sum, block) => sum + block.exercises.length, 0)
}

/** Yleisin arvo. Tasapelissä ensimmäisenä tullut, eli liikkeen ensimmäinen sarja ratkaisee. */
function mostCommon(values: number[]): number | undefined {
  let best: number | undefined
  let bestCount = 0
  const counts = new Map<number, number>()
  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1
    counts.set(value, count)
    if (count > bestCount) {
      best = value
      bestCount = count
    }
  }
  return best
}

/**
 * Pohja treenistä sellaisena kuin se näytti lopussa: kaikki liikkeet (myös
 * tekemättömät), sarjamäärä riveistä ja toistot rivien yleisimmästä arvosta.
 * Näin lisätty sarja tai muutettu toistomäärä jää pohjaan, mutta oletus
 * 3 × 10 ei jää, jos sitä muutti.
 */
export function fromSession(session: ActiveSession, id: string, name: string): WorkoutTemplate {
  const blocks: Block[] = session.blocks.map((block) => ({
    id: block.id,
    restSec: block.restSec,
    exercises: block.exercises.map((entry) => {
      const time = entry.measurement === 'time'
      const value =
        mostCommon(
          entry.sets
            .map((set) => (time ? set.durationSec : set.reps))
            .filter((v): v is number => v !== undefined && v > 0),
        ) ?? (time ? 30 : DEFAULT_REPS)
      return {
        exerciseId: entry.exerciseId,
        sets: entry.sets.map(() =>
          time ? { durationSec: value, done: false } : { reps: value, done: false },
        ),
      }
    }),
  }))
  return { id, name, blocks }
}
