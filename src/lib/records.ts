import type { SessionExercise } from '@/types/session'
import type { Workout } from '@/types/workout'

export interface RecordEntry {
  exerciseId: string
  weightKg: number
  /** Kuinka paljon edellistä ennätystä suurempi. */
  deltaKg: number
}

/** Liikkeen suurin tehty paino kaikissa aiemmissa treeneissä. Null jos liikettä ei ole tehty. */
export function bestWeightKg(exerciseId: string, history: Workout[]): number | null {
  const weights = history
    .flatMap((workout) => workout.logged?.blocks ?? [])
    .flatMap((block) => block.exercises)
    .filter((exercise) => exercise.exerciseId === exerciseId)
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.done && set.weightKg)
    .map((set) => set.weightKg as number)

  return weights.length ? Math.max(...weights) : null
}

/**
 * Treenin ennätykset: liike, jossa nostettiin raskaammin kuin koskaan ennen.
 *
 * - Ensimmäinen kerta ei ole ennätys, koska ei ole mihin verrata.
 * - Uusi paino lasketaan vain jos sillä tehtiin vähintään tavoitetoistot.
 *   Yhden toiston kokeilu raskaammalla ei ole ennätys, joka kertoisi
 *   mistään hyödyllisestä.
 */
export function findRecords(exercises: SessionExercise[], history: Workout[]): RecordEntry[] {
  const records: RecordEntry[] = []

  for (const exercise of exercises) {
    if (exercise.measurement !== 'weight_reps') continue

    const previous = bestWeightKg(exercise.exerciseId, history)
    if (previous === null) continue

    const weights = exercise.sets
      .filter((set) => set.done && set.weightKg && (set.reps ?? 0) >= exercise.target.reps)
      .map((set) => set.weightKg as number)
    if (!weights.length) continue

    const best = Math.max(...weights)
    if (best > previous) {
      records.push({ exerciseId: exercise.exerciseId, weightKg: best, deltaKg: best - previous })
    }
  }

  return records
}
