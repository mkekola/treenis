import { DEFAULT_REPS, mostCommon } from '@/lib/template'
import type { Block, BlockExercise, SetEntry, Workout, WorkoutTemplate } from '@/types/workout'

/**
 * Poikkeamat pohjasta. Treeni pitää pohjan lohkojen tunnisteet, joten tehtyä
 * treeniä voi verrata pohjaan lohko lohkolta. Toistot ja painot eivät ole
 * poikkeamia: ne kuuluvat progressiolle, joka ehdottaa niistä painon nostoa.
 *
 * Avain tunnistaa saman poikkeaman eri kerroilla. Lisätyn liikkeen lohkolla on
 * joka kerta uusi tunniste, joten sen avain on pelkkä liike.
 */
export type Deviation =
  | { kind: 'swap'; key: string; blockId: string; fromId: string; toId: string; sets: SetEntry[] }
  | { kind: 'sets'; key: string; blockId: string; exerciseId: string; from: number; to: number }
  | { kind: 'remove'; key: string; blockId: string; exerciseId: string }
  | { kind: 'add'; key: string; exerciseId: string; restSec: number; sets: SetEntry[] }

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/**
 * Tavoitesarjat sellaisina kuin liike tehtiin: tehtyjen sarjojen määrä ja
 * niiden yleisin toistomäärä (aikaliikkeellä kesto).
 */
function targetsFrom(entry: BlockExercise): SetEntry[] {
  const done = entry.sets.filter((set) => set.done)
  const time = done.some((set) => set.durationSec !== undefined && set.reps === undefined)
  const value =
    mostCommon(
      done.map((set) => (time ? set.durationSec : set.reps)).filter((v): v is number => v !== undefined && v > 0),
    ) ?? (time ? 30 : DEFAULT_REPS)
  return done.map(() => (time ? { durationSec: value, done: false } : { reps: value, done: false }))
}

function doneCount(entry: BlockExercise): number {
  return entry.sets.filter((set) => set.done).length
}

function added(entry: BlockExercise, restSec: number): Deviation {
  return { kind: 'add', key: `add:${entry.exerciseId}`, exerciseId: entry.exerciseId, restSec, sets: targetsFrom(entry) }
}

/** Treenin poikkeamat pohjasta. Treenissä ovat mukana vain tehdyt liikkeet ja sarjat. */
export function findDeviations(template: WorkoutTemplate, workout: Workout): Deviation[] {
  const performed = (workout.logged?.blocks ?? []).map((block) => ({
    ...block,
    exercises: block.exercises.filter((entry) => doneCount(entry) > 0),
  }))
  const performedById = new Map(performed.map((block) => [block.id, block]))
  const deviations: Deviation[] = []

  for (const block of template.blocks) {
    const done = performedById.get(block.id)?.exercises ?? []
    const planned = block.exercises.map((entry) => entry.exerciseId)
    const doneIds = done.map((entry) => entry.exerciseId)
    const missing = planned.filter((id) => !doneIds.includes(id))
    const extra = done.filter((entry) => !planned.includes(entry.exerciseId))

    // Lohkossa pois jäänyt ja tilalle tullut liike ovat vaihto, järjestyksessä pareittain.
    missing.forEach((fromId, i) => {
      const replacement = extra[i]
      if (replacement) {
        const toId = replacement.exerciseId
        deviations.push({
          kind: 'swap',
          key: `swap:${block.id}:${fromId}:${toId}`,
          blockId: block.id,
          fromId,
          toId,
          sets: targetsFrom(replacement),
        })
      } else {
        deviations.push({ kind: 'remove', key: `remove:${block.id}:${fromId}`, blockId: block.id, exerciseId: fromId })
      }
    })
    for (const entry of extra.slice(missing.length)) deviations.push(added(entry, block.restSec))

    for (const entry of block.exercises) {
      const match = done.find((d) => d.exerciseId === entry.exerciseId)
      if (!match) continue
      const from = entry.sets.length
      const to = doneCount(match)
      if (from !== to) {
        deviations.push({
          kind: 'sets',
          key: `sets:${block.id}:${entry.exerciseId}:${to}`,
          blockId: block.id,
          exerciseId: entry.exerciseId,
          from,
          to,
        })
      }
    }
  }

  const templateBlockIds = new Set(template.blocks.map((block) => block.id))
  for (const block of performed) {
    if (templateBlockIds.has(block.id)) continue
    for (const entry of block.exercises) deviations.push(added(entry, block.restSec))
  }

  return deviations
}

function startOf(workout: Workout): string {
  return workout.logged?.startedAt ?? workout.date
}

/** Edellinen samasta pohjasta aloitettu treeni ennen annettua. */
function previousFromTemplate(templateId: string, current: Workout, history: Workout[]): Workout | undefined {
  return history
    .filter((w) => w.templateId === templateId && w.id !== current.id && startOf(w) < startOf(current))
    .sort((a, b) => startOf(b).localeCompare(startOf(a)))[0]
}

/**
 * Poikkeamat, joista kysytään: sama muutos tällä ja edellisellä kerralla, eikä
 * käyttäjä ole jo päättänyt pitää pohjan ennallaan.
 */
export function recurringDeviations(template: WorkoutTemplate, current: Workout, history: Workout[]): Deviation[] {
  const previous = previousFromTemplate(template.id, current, history)
  if (!previous) return []
  const before = new Set(findDeviations(template, previous).map((d) => d.key))
  const kept = new Set(template.keptDeviations ?? [])
  return findDeviations(template, current).filter((d) => before.has(d.key) && !kept.has(d.key))
}

/** Päivittää pohjan vastaamaan sitä, miten treeni on viime kerrat tehty. */
export function applyDeviations(
  template: WorkoutTemplate,
  deviations: Deviation[],
  newBlockId: () => string,
): WorkoutTemplate {
  const next = clone(template)
  const blockOf = (id: string) => next.blocks.find((block) => block.id === id)

  for (const d of deviations) {
    if (d.kind === 'swap') {
      const entry = blockOf(d.blockId)?.exercises.find((e) => e.exerciseId === d.fromId)
      if (entry) {
        entry.exerciseId = d.toId
        entry.sets = clone(d.sets)
      }
    } else if (d.kind === 'sets') {
      const entry = blockOf(d.blockId)?.exercises.find((e) => e.exerciseId === d.exerciseId)
      const first = entry?.sets[0]
      if (entry && first) entry.sets = Array.from({ length: d.to }, () => ({ ...first, done: false }))
    } else if (d.kind === 'remove') {
      const block = blockOf(d.blockId)
      if (block) block.exercises = block.exercises.filter((e) => e.exerciseId !== d.exerciseId)
    } else {
      const block: Block = {
        id: newBlockId(),
        restSec: d.restSec,
        exercises: [{ exerciseId: d.exerciseId, sets: clone(d.sets) }],
      }
      next.blocks.push(block)
    }
  }

  next.blocks = next.blocks.filter((block) => block.exercises.length > 0)
  return next
}

/** "Pidä vanha": samasta poikkeamasta ei kysytä uudelleen niin kauan kuin se jatkuu. */
export function keepDeviations(template: WorkoutTemplate, deviations: Deviation[]): WorkoutTemplate {
  const kept = new Set([...(template.keptDeviations ?? []), ...deviations.map((d) => d.key)])
  return { ...clone(template), keptDeviations: [...kept] }
}

/**
 * Unohtaa "Pidä vanha" -päätökset, joiden poikkeamaa ei tällä kertaa tehty.
 * Jos sama muutos palaa myöhemmin, siitä kysytään taas kahden kerran jälkeen.
 */
export function pruneKept(template: WorkoutTemplate, workout: Workout): WorkoutTemplate {
  if (!template.keptDeviations?.length) return template
  const current = new Set(findDeviations(template, workout).map((d) => d.key))
  return { ...clone(template), keptDeviations: template.keptDeviations.filter((key) => current.has(key)) }
}
