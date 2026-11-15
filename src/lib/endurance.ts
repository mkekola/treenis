import { localDate } from '@/lib/session'
import { avgHr, distanceM, durationSec } from '@/lib/workout'
import type { SportKey, Workout } from '@/types/workout'

/**
 * Kestävyyden kehitys: kun juoksee samalla keskisykkeellä, kunnon kasvu näkyy
 * vauhdin paranemisena (tai saman ajan matkan kasvuna).
 */

export interface EffortPoint {
  workoutId: string
  date: string
  durationSec: number
  distanceM: number
  avgHr?: number
  /** Sekunteja kilometrille. Pienempi on nopeampi. */
  paceSecPerKm: number
}

export interface HrRange {
  min: number
  max: number
}

/** Oletushaarukka, kunnes käyttäjä asettaa oman PK-alueensa. */
export const DEFAULT_HR_RANGE: HrRange = { min: 125, max: 135 }

/** Treeni pisteeksi, jos siinä on sekä kesto että matka. */
export function effortOf(workout: Workout): EffortPoint | null {
  const duration = durationSec(workout)
  const distance = distanceM(workout)
  if (!duration || !distance) return null
  return {
    workoutId: workout.id,
    date: workout.date,
    durationSec: duration,
    distanceM: distance,
    avgHr: avgHr(workout),
    paceSecPerKm: duration / (distance / 1000),
  }
}

/** Kuuden kuukauden ikkunan alku: sama päivä kuusi kuukautta sitten. */
export function sixMonthsBefore(now: Date): string {
  return localDate(new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()))
}

/**
 * Lajin treenit, joiden keskisyke osuu haarukkaan (rajat mukaan lukien), viimeiseltä
 * kuudelta kuukaudelta vanhimmasta uusimpaan. Ilman keskisykettä treeni ei ole mukana.
 */
export function effortsInRange(workouts: Workout[], sport: SportKey, range: HrRange, now: Date): EffortPoint[] {
  const from = sixMonthsBefore(now)
  const today = localDate(now)
  return workouts
    .filter((w) => w.sport === sport && w.date >= from && w.date <= today)
    .map(effortOf)
    .filter((p): p is EffortPoint => p !== null && p.avgHr !== undefined && p.avgHr >= range.min && p.avgHr <= range.max)
    .sort((a, b) => a.date.localeCompare(b.date))
}

/** Pohjan kerrat uusimmasta vanhimpaan. Mukana myös ne, joista puuttuu matka. */
export function templateHistory(workouts: Workout[], templateId: string): Workout[] {
  return workouts.filter((w) => w.templateId === templateId).sort((a, b) => b.date.localeCompare(a.date))
}

/** "6.23" sekunneista kilometrille. */
export function paceLabel(secPerKm: number): string {
  const rounded = Math.round(secPerKm)
  return `${Math.floor(rounded / 60)}.${String(rounded % 60).padStart(2, '0')}`
}
