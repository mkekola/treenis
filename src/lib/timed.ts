import type { Measurement, SetEntry } from '@/types/workout'

/**
 * Aikasarja: toisto- tai painoliike tehdään annetussa ajassa, esimerkiksi minuutti
 * vatsarutistuksia, ja kirjataan, montako toistoa siinä ajassa tuli. Tehdyssä sarjassa
 * on silloin sekä kesto että toistot. Lankun kaltainen aikaliike on eri asia: siinä
 * kesto on itse tulos eikä toistoja ole.
 */
export const isTimedSet = (set: SetEntry) => set.durationSec !== undefined && set.reps !== undefined

/** Onko liikkeen tavoite aika: toisto- tai painoliike, jonka sarjoilla on kesto. */
export function hasTimeTarget(sets: SetEntry[], measurement: Measurement): boolean {
  return measurement !== 'time' && sets[0]?.durationSec !== undefined
}

/** Työaika luettavasti: "45 s", "1 min", "1 min 30 s". */
export function formatWorkTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (!minutes) return `${rest}\u00A0s`
  return rest ? `${minutes}\u00A0min ${rest}\u00A0s` : `${minutes}\u00A0min`
}
