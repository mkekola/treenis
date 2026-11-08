import type { Exercise, Feel, SetEntry } from '@/types/workout'

/** Yhden liikkeen suoritus yhdellä treenikerralla. */
export interface ExerciseSession {
  sets: SetEntry[]
  feel?: Feel
}

/** Pohjan tavoite liikkeelle, esim. 3 × 12. */
export interface Target {
  sets: number
  reps: number
}

export type Suggestion =
  | { kind: 'increase'; fromKg: number; toKg: number }
  | { kind: 'keep'; kg: number }
  | { kind: 'decrease'; fromKg: number; toKg: number }

const DEFAULT_STEP_KG = 2.5
const LIGHT: Feel[] = ['very_easy', 'easy']
const HEAVY: Feel[] = ['hard', 'max']

/** Treenin työpaino: suurin tehty paino. Null jos painoa ei ole kirjattu. */
export function workingWeightKg(session: ExerciseSession): number | null {
  const weights = session.sets
    .filter((set) => set.done && set.weightKg)
    .map((set) => set.weightKg as number)
  return weights.length ? Math.max(...weights) : null
}

/** Menikö jokainen tavoitesarja vähintään tavoitetoistoihin. */
function hitTarget(session: ExerciseSession, target: Target): boolean {
  const done = session.sets.filter((set) => set.done)
  return done.length >= target.sets && done.every((set) => (set.reps ?? 0) >= target.reps)
}

/**
 * Tehtiinkö selvästi enemmän kuin ohjelmassa: kaikki sarjat tavoitteeseen ja
 * ylimääräisiä toistoja yhteensä vähintään yhtä monta kuin sarjoja.
 * Esim. 3 × 12: 15, 14, 12 riittää (5 yli), 13, 12, 12 ei (1 yli).
 */
function exceededTarget(session: ExerciseSession, target: Target): boolean {
  if (!hitTarget(session, target)) return false
  const surplus = session.sets
    .filter((set) => set.done)
    .reduce((sum, set) => sum + ((set.reps ?? 0) - target.reps), 0)
  return surplus >= target.sets
}

function heavyMiss(session: ExerciseSession, target: Target): boolean {
  return !hitTarget(session, target) && session.feel !== undefined && HEAVY.includes(session.feel)
}

/**
 * Ehdotus seuraavan kerran painoksi, uusin suoritus ensin.
 *
 * - **Nosta**, kun viimeksi kaikki sarjat menivät tavoitteeseen ja joko
 *   tuntui kevyeltä tai toistoja tehtiin selvästi yli ohjelman. Ylimääräiset
 *   toistot ovat mitattua dataa ja riittävät ilman vastaustakin, paitsi jos
 *   käyttäjä sanoi liikkeen raskaaksi: silloin hänen arvionsa voittaa.
 *   Kevyt tuntuma ilman täysiä toistoja ei riitä: ne ovat ristiriidassa, ja
 *   silloin luotetaan toistoihin.
 * - **Laske**, kun toistot jäivät vajaiksi raskaana kaksi kertaa peräkkäin.
 *   Yksi huono päivä ei riitä.
 * - Muuten **pidä**. Sovellus ei nosta painoa pelkän puuttuvan vastauksen
 *   perusteella: nosto vaatii joko kevyen tuntuman tai ylimääräiset toistot.
 *
 * Koskee vain paino × toistot -liikkeitä; muille palautetaan null.
 */
export function suggestNext(
  exercise: Exercise,
  target: Target,
  history: ExerciseSession[],
): Suggestion | null {
  if (exercise.measurement !== 'weight_reps') return null

  const [last, previous] = history
  if (!last) return null

  const kg = workingWeightKg(last)
  if (kg === null) return null

  const step = exercise.weightStepKg ?? DEFAULT_STEP_KG

  const saidLight = last.feel !== undefined && LIGHT.includes(last.feel)
  const saidHeavy = last.feel !== undefined && HEAVY.includes(last.feel)
  const didExtra = exceededTarget(last, target) && !saidHeavy

  if (hitTarget(last, target) && (saidLight || didExtra)) {
    return { kind: 'increase', fromKg: kg, toKg: kg + step }
  }

  if (previous && heavyMiss(last, target) && heavyMiss(previous, target)) {
    return { kind: 'decrease', fromKg: kg, toKg: Math.max(step, kg - step) }
  }

  return { kind: 'keep', kg }
}
