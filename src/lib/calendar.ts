import { localDate } from '@/lib/session'
import type { Workout } from '@/types/workout'

/** Viikko alkaa maanantaista, kuten Suomessa. Palauttaa maanantain muodossa 2026-11-09. */
export function weekStart(now: Date): string {
  const monday = new Date(now)
  const sinceMonday = (now.getDay() + 6) % 7
  monday.setDate(now.getDate() - sinceMonday)
  return localDate(monday)
}

/** Tämän viikon treenit, maanantaista sunnuntaihin. Päivämäärät vertautuvat merkkijonoina. */
export function thisWeek(workouts: Workout[], now: Date): Workout[] {
  const start = weekStart(now)
  const end = new Date(`${start}T00:00:00`)
  end.setDate(end.getDate() + 7)
  const endDate = localDate(end)
  return workouts.filter((w) => w.date >= start && w.date < endDate)
}

/** Uusin ensin. Saman päivän treenit aloitusajan mukaan. */
export function newestFirst(workouts: Workout[]): Workout[] {
  const startedAt = (w: Workout) => w.measured?.startedAt ?? w.logged?.startedAt ?? ''
  return [...workouts].sort(
    (a, b) => b.date.localeCompare(a.date) || startedAt(b).localeCompare(startedAt(a)),
  )
}

export interface MonthGroup {
  key: string
  label: string
  workouts: Workout[]
}

/** Aikajana kuukausittain, uusin ensin. Vuosi näytetään vain muilta kuin kuluvalta vuodelta. */
export function byMonth(workouts: Workout[], now: Date): MonthGroup[] {
  const groups = new Map<string, Workout[]>()
  for (const workout of newestFirst(workouts)) {
    const key = workout.date.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), workout])
  }
  return [...groups.entries()].map(([key, list]) => {
    const date = new Date(`${key}-01T00:00:00`)
    const month = date.toLocaleDateString('fi-FI', { month: 'long' })
    const label = month.charAt(0).toUpperCase() + month.slice(1)
    const year = date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`
    return { key, label: `${label}${year}`, workouts: list }
  })
}

/** "Tiistai 10.11." */
export function formatToday(now: Date): string {
  const weekday = now.toLocaleDateString('fi-FI', { weekday: 'long' })
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${now.getDate()}.${now.getMonth() + 1}.`
}
