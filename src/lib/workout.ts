import { EXERCISES_BY_ID } from '@/data/exerciseLibrary'
import { SPORT_KIND, type SportKind, type Workout } from '@/types/workout'

/**
 * Sääntö koko sovellukselle: **mitattu voittaa kirjatun.**
 * Kello mittaa keston tarkemmin kuin käsin käynnistetty ajastin, joten
 * Stravasta saapunut arvo syrjäyttää oman kirjauksen aina kun se on olemassa.
 */
export function durationSec(workout: Workout): number {
  return workout.measured?.durationSec ?? workout.logged?.durationSec ?? 0
}

export function distanceM(workout: Workout): number | undefined {
  return workout.measured?.distanceM
}

export function avgHr(workout: Workout): number | undefined {
  return workout.measured?.avgHr
}

export function kindOf(workout: Workout): SportKind {
  return SPORT_KIND[workout.sport]
}

export function isFromStrava(workout: Workout): boolean {
  return workout.measured !== undefined
}

/** Kaikki tehdyt sarjat lohkoista välittämättä, liikkeen tunnisteen kanssa. */
function doneSets(workout: Workout) {
  return (workout.logged?.blocks ?? []).flatMap((block) =>
    block.exercises.flatMap((exercise) =>
      exercise.sets.filter((set) => set.done).map((set) => ({ ...set, exerciseId: exercise.exerciseId })),
    ),
  )
}

const libraryPerSide = (exerciseId: string) => EXERCISES_BY_ID[exerciseId]?.perSide ?? false

/**
 * Salitreenin tilavuus: ulkoinen kuorma × toistot. Lankku ja muut aikaan
 * perustuvat liikkeet eivät kasvata sitä, koska niissä ei ole toistoja.
 *
 * Yhden puolen liikkeissä kirjattu luku on per puoli, joten tilavuus
 * kaksinkertaistetaan: 40 kg × 10 toistoa yhdellä jalalla on 800 kg, kun
 * molemmat jalat on tehty. Silloin tilavuus tarkoittaa samaa asiaa jokaisessa
 * liikkeessä. Omat liikkeet eivät ole staattisessa kirjastossa, joten kutsuja
 * voi antaa oman perSide-haun.
 */
export function totalVolumeKg(
  workout: Workout,
  isPerSide: (exerciseId: string) => boolean = libraryPerSide,
): number {
  return doneSets(workout).reduce((sum, set) => {
    if (!set.weightKg || !set.reps) return sum
    const sides = isPerSide(set.exerciseId) ? 2 : 1
    return sum + set.weightKg * set.reps * sides
  }, 0)
}
