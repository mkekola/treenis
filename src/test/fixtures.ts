import { EXERCISES_BY_ID } from '@/data/exerciseLibrary'
import type { BlockExercise, Exercise, Feel, SetEntry, Workout } from '@/types/workout'

/** Testidatan apufunktiot. Vain testit käyttävät tätä, sovellus ei. */

export function doneSets(kg: number, reps: number[]): SetEntry[] {
  return reps.map((r) => ({ weightKg: kg, reps: r, done: true }))
}

export function entry(exerciseId: string, sets: SetEntry[], feel?: Feel): BlockExercise {
  return { exerciseId, sets, feel }
}

/** Salitreeni, jossa jokainen liike on omassa lohkossaan. */
export function strengthWorkout(
  id: string,
  date: string,
  exercises: BlockExercise[],
  startedAt?: string,
): Workout {
  return {
    id,
    sport: 'strength',
    date,
    title: 'Treeni 1',
    logged: {
      startedAt,
      blocks: exercises.map((exercise, index) => ({
        id: `${id}-b${index}`,
        restSec: 90,
        exercises: [exercise],
      })),
    },
  }
}

export function exercise(id: string): Exercise {
  const found = EXERCISES_BY_ID[id]
  if (!found) throw new Error(`Liikettä ei ole kirjastossa: ${id}`)
  return found
}

export const lookup = (id: string): Exercise | undefined => EXERCISES_BY_ID[id]
