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
