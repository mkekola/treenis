import type { BlockExercise, RotationOption, Workout } from '@/types/workout'

/**
 * Vaihtuva liike: pohjan liikkeellä on kierto, esimerkiksi kyykky → maastaveto → etukyykky.
 * Vuorossa on liike, joka seuraa viimeksi tällä pohjalla tehtyä. Kierto etenee kerroittain
 * eikä kalenterin mukaan, joten väliin jäänyt viikko ei sotke sitä. Käsin vaihdettu liike
 * lasketaan: kierto jatkuu siitä, mitä oikeasti tehtiin.
 */

/** Kierron liikkeet järjestyksessä. Tavallisella liikkeellä vain se itse. */
export function optionsOf(entry: BlockExercise): RotationOption[] {
  return [{ exerciseId: entry.exerciseId, sets: entry.sets }, ...(entry.alternatives ?? [])]
}

export const isRotating = (entry: BlockExercise) => (entry.alternatives?.length ?? 0) > 0

const startOf = (workout: Workout) => workout.logged?.startedAt ?? workout.date

/**
 * Vuorossa olevan liikkeen paikka kierrossa. Treeni pitää pohjan lohkojen tunnisteet,
 * joten edellinen kerta löytyy samasta lohkosta. Jos kiertoa ei ole vielä tehty, alku.
 */
export function nextOptionIndex(
  templateId: string,
  blockId: string,
  entry: BlockExercise,
  history: Workout[],
): number {
  const ids = optionsOf(entry).map((option) => option.exerciseId)
  if (ids.length < 2) return 0
  const fromTemplate = history
    .filter((w) => w.templateId === templateId && !w.deletedAt)
    .sort((a, b) => startOf(b).localeCompare(startOf(a)))
  for (const workout of fromTemplate) {
    const block = workout.logged?.blocks?.find((b) => b.id === blockId)
    const done = block?.exercises.find((e) => ids.includes(e.exerciseId) && e.sets.some((set) => set.done))
    if (done) return (ids.indexOf(done.exerciseId) + 1) % ids.length
  }
  return 0
}
