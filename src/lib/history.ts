import type { ExerciseSession } from '@/lib/progression'
import type { Workout } from '@/types/workout'

function newestFirst(a: Workout, b: Workout): number {
  return (
    b.date.localeCompare(a.date) ||
    (b.logged?.startedAt ?? '').localeCompare(a.logged?.startedAt ?? '')
  )
}

/**
 * Liikkeen viimeisimmät suoritukset, uusin ensin. Yksi per treeni, ja vain
 * sellaiset joissa on tehty sarja. Progressiosääntö tarvitsee kaksi: viimeisin
 * ja sitä edellinen ("laske" vaatii kaksi peräkkäistä vaikeaa kertaa).
 */
export function sessionsFor(
  exerciseId: string,
  workouts: Workout[],
  limit = 2,
): ExerciseSession[] {
  const sessions: ExerciseSession[] = []

  for (const workout of [...workouts].sort(newestFirst)) {
    const found = (workout.logged?.blocks ?? [])
      .flatMap((block) => block.exercises)
      .find((exercise) => exercise.exerciseId === exerciseId && exercise.sets.some((s) => s.done))

    if (!found) continue
    sessions.push({ sets: found.sets, feel: found.feel })
    if (sessions.length === limit) break
  }

  return sessions
}

/**
 * Eniten tehdyt liikkeet annetun ajan sisällä: monessako treenissä liikkeestä
 * on tehty sarja. Tasatilanteessa tuoreemmin tehty ensin. Aikaraja pitää
 * listan nykyisessä ohjelmassa: vanhan ohjelman liikkeet putoavat pois itsestään.
 */
export function frequentExerciseIds(workouts: Workout[], since: string, limit = 8): string[] {
  const counts = new Map<string, { count: number; last: string }>()

  for (const workout of workouts) {
    if (workout.date < since) continue
    const done = new Set(
      (workout.logged?.blocks ?? [])
        .flatMap((block) => block.exercises)
        .filter((exercise) => exercise.sets.some((set) => set.done))
        .map((exercise) => exercise.exerciseId),
    )
    for (const id of done) {
      const row = counts.get(id) ?? { count: 0, last: '' }
      counts.set(id, { count: row.count + 1, last: workout.date > row.last ? workout.date : row.last })
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || b[1].last.localeCompare(a[1].last))
    .slice(0, limit)
    .map(([id]) => id)
}
