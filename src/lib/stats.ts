import { SPORT_GROUP_OF, type SportGroupKey } from '@/design/sportGroups'
import { localDate } from '@/lib/session'
import { distanceM, durationSec } from '@/lib/workout'
import type { Exercise, SportKey, Workout } from '@/types/workout'

/**
 * Tilastojen laskenta. Kaikki funktiot saavat "tämän päivän" parametrina, jotta
 * ne voi testata ilman kelloa. Päivämäärät ovat paikallisia merkkijonoja
 * (2026-11-12), joten niitä voi verrata suoraan.
 */

export type StatsView = 'week' | 'month' | 'year'

export interface Period {
  view: StatsView
  /** Ensimmäinen päivä. */
  start: string
  /** Ensimmäinen päivä jakson jälkeen. */
  end: string
}

const MONTHS = [
  'tammikuu', 'helmikuu', 'maaliskuu', 'huhtikuu', 'toukokuu', 'kesäkuu',
  'heinäkuu', 'elokuu', 'syyskuu', 'lokakuu', 'marraskuu', 'joulukuu',
]

function day(date: string): Date {
  return new Date(`${date}T00:00:00`)
}

export function addDays(date: string, days: number): string {
  const d = day(date)
  d.setDate(d.getDate() + days)
  return localDate(d)
}

export function mondayOf(date: string): string {
  const d = day(date)
  return addDays(date, -((d.getDay() + 6) % 7))
}

/** Jakso, johon päivä kuuluu. Viikko alkaa maanantaista. */
export function periodOf(view: StatsView, date: string): Period {
  const d = day(date)
  if (view === 'year') {
    return { view, start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear() + 1}-01-01` }
  }
  if (view === 'month') {
    return {
      view,
      start: localDate(new Date(d.getFullYear(), d.getMonth(), 1)),
      end: localDate(new Date(d.getFullYear(), d.getMonth() + 1, 1)),
    }
  }
  const start = mondayOf(date)
  return { view, start, end: addDays(start, 7) }
}

/** Edellinen (-1) tai seuraava (+1) samanpituinen jakso. */
export function shiftPeriod(period: Period, direction: -1 | 1): Period {
  return periodOf(period.view, direction === 1 ? period.end : addDays(period.start, -1))
}

/** ISO-viikkonumero, jota Suomessa käytetään. */
export function weekNumber(date: string): number {
  const d = day(date)
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7))
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
}

const shortDate = (date: string) => {
  const d = day(date)
  return `${d.getDate()}.${d.getMonth() + 1}.`
}

/** "2026", "Toukokuu 2026", "Viikko 46 · 9.11.–15.11." */
export function periodLabel(period: Period): string {
  const d = day(period.start)
  if (period.view === 'year') return String(d.getFullYear())
  if (period.view === 'month') {
    const name = MONTHS[d.getMonth()]
    return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${d.getFullYear()}`
  }
  return `Viikko ${weekNumber(period.start)} · ${shortDate(period.start)}–${shortDate(addDays(period.end, -1))}`
}

/** Mihin edelliseen jaksoon verrataan: "huhtikuuhun", "vuoteen 2025", "edelliseen viikkoon". */
export function comparisonLabel(period: Period): string {
  const previous = shiftPeriod(period, -1)
  if (period.view === 'year') return `vuoteen ${day(previous.start).getFullYear()}`
  if (period.view === 'month') return `${MONTHS[day(previous.start).getMonth()]}hun`
  return 'edelliseen viikkoon'
}

export function inPeriod(workouts: Workout[], period: Pick<Period, 'start' | 'end'>): Workout[] {
  return workouts.filter((w) => w.date >= period.start && w.date < period.end)
}

export function totalSeconds(workouts: Workout[]): number {
  return workouts.reduce((sum, w) => sum + durationSec(w), 0)
}

/** Kävelyn, juoksun ja vaelluksen matka, eli sama ryhmä kuin värikoodissa. */
export function footMeters(workouts: Workout[]): number {
  return workouts
    .filter((w) => SPORT_GROUP_OF[w.sport] === 'land')
    .reduce((sum, w) => sum + (distanceM(w) ?? 0), 0)
}

// ------------------------------------------------------------- säännöllisyys

/** Treeniaika päivittäin. */
export function secondsByDay(workouts: Workout[]): Map<string, number> {
  const days = new Map<string, number>()
  for (const w of workouts) days.set(w.date, (days.get(w.date) ?? 0) + durationSec(w))
  return days
}

/** Ruudun tummuus 0–4 päivän treeniajasta: alle 30 min, alle tunti, alle 1,5 t, enemmän. */
export function heatLevel(seconds: number | undefined): 0 | 1 | 2 | 3 | 4 {
  if (!seconds) return 0
  if (seconds < 30 * 60) return 1
  if (seconds < 60 * 60) return 2
  if (seconds < 90 * 60) return 3
  return 4
}

export type WeekStreak =
  /** Jakso sisältää tämän päivän: putki tähän asti ja tämän viikon tilanne. */
  | { kind: 'current'; weeks: number; thisWeek: number; goal: number }
  /** Mennyt jakso: pisin putki sen sisällä. */
  | { kind: 'past'; weeks: number; goal: number }

/**
 * Viikkoputki: peräkkäiset viikot, joilla on vähintään goal treeniä. Päiväputki
 * palkitsisi lepopäivien välttelystä, tämä ei: lepo mahtuu jokaiseen viikkoon.
 * Kesken oleva viikko ei katkaise putkea ennen kuin se on ohi.
 */
export function weekStreak(workouts: Workout[], period: Period, today: string, goal = 2): WeekStreak {
  const count = (monday: string) => inPeriod(workouts, { start: monday, end: addDays(monday, 7) }).length

  if (period.start <= today && today < period.end) {
    const thisMonday = mondayOf(today)
    const thisWeek = count(thisMonday)
    let monday = thisWeek >= goal ? thisMonday : addDays(thisMonday, -7)
    let weeks = 0
    while (count(monday) >= goal) {
      weeks++
      monday = addDays(monday, -7)
    }
    return { kind: 'current', weeks, thisWeek, goal }
  }

  let best = 0
  let current = 0
  for (let monday = mondayOf(period.start); monday < period.end; monday = addDays(monday, 7)) {
    current = count(monday) >= goal ? current + 1 : 0
    best = Math.max(best, current)
  }
  return { kind: 'past', weeks: best, goal }
}

// ---------------------------------------------------------------- tasapaino

/** Aika lajiryhmittäin, suurin ensin. */
export function secondsByGroup(workouts: Workout[]): { group: SportGroupKey; seconds: number }[] {
  const groups = new Map<SportGroupKey, number>()
  for (const w of workouts) {
    const group = SPORT_GROUP_OF[w.sport]
    groups.set(group, (groups.get(group) ?? 0) + durationSec(w))
  }
  return [...groups.entries()]
    .map(([group, seconds]) => ({ group, seconds }))
    .filter((row) => row.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)
}

// ---------------------------------------------------------------- kestävyys

export interface Bucket {
  label: string
  /** Pidempi nimi saavutettavaan kuvaukseen ja vihjeeseen. */
  title: string
  meters: number
  future: boolean
}

const MONTH_INITIALS = ['T', 'H', 'M', 'H', 'T', 'K', 'H', 'E', 'S', 'L', 'M', 'J']
const WEEKDAYS = ['ma', 'ti', 'ke', 'to', 'pe', 'la', 'su']

/** Jalan kuljettu matka jakson sisällä: vuosi kuukausittain, kuukausi viikoittain, viikko päivittäin. */
export function footBuckets(workouts: Workout[], period: Period, today: string): Bucket[] {
  const foot = workouts.filter((w) => SPORT_GROUP_OF[w.sport] === 'land')
  const meters = (start: string, end: string) => footMeters(inPeriod(foot, { start, end }))

  if (period.view === 'year') {
    const year = day(period.start).getFullYear()
    return MONTH_INITIALS.map((label, m) => {
      const start = localDate(new Date(year, m, 1))
      const end = localDate(new Date(year, m + 1, 1))
      const name = MONTHS[m]
      return { label, title: `${name.charAt(0).toUpperCase()}${name.slice(1)}`, meters: meters(start, end), future: start > today }
    })
  }
  if (period.view === 'month') {
    const buckets: Bucket[] = []
    for (let monday = mondayOf(period.start); monday < period.end; monday = addDays(monday, 7)) {
      const week = weekNumber(monday)
      buckets.push({ label: `vk ${week}`, title: `Viikko ${week}`, meters: meters(monday, addDays(monday, 7)), future: monday > today })
    }
    return buckets
  }
  return WEEKDAYS.map((label, i) => {
    const date = addDays(period.start, i)
    return { label, title: shortDate(date), meters: meters(date, addDays(date, 1)), future: date > today }
  })
}

/** Muut matkalajit riveinä, koska uinti mitataan metreinä eikä kilometreinä. */
export function sportTotals(workouts: Workout[], sport: SportKey): { count: number; meters: number } {
  const list = workouts.filter((w) => w.sport === sport)
  return { count: list.length, meters: list.reduce((sum, w) => sum + (distanceM(w) ?? 0), 0) }
}

// -------------------------------------------------------------- salikehitys

export interface LiftProgress {
  exerciseId: string
  /** Kunkin kerran raskain tehty sarja, vanhin ensin. */
  weights: number[]
}

/**
 * Painoliikkeiden kehitys: jokaiselta kerralta raskain tehty sarja. Mukana
 * liikkeet, jotka on tehty vähintään kahdesti, useimmin tehdyt ensin.
 */
export function liftProgress(
  workouts: Workout[],
  lookup: (id: string) => Exercise | undefined,
  limit = 5,
): LiftProgress[] {
  const sessions = new Map<string, { date: string; kg: number }[]>()
  for (const w of workouts) {
    for (const block of w.logged?.blocks ?? []) {
      for (const entry of block.exercises) {
        if (lookup(entry.exerciseId)?.measurement !== 'weight_reps') continue
        const kg = Math.max(0, ...entry.sets.filter((s) => s.done).map((s) => s.weightKg ?? 0))
        if (kg <= 0) continue
        const list = sessions.get(entry.exerciseId) ?? []
        list.push({ date: w.date, kg })
        sessions.set(entry.exerciseId, list)
      }
    }
  }
  return [...sessions.entries()]
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([exerciseId, list]) => ({
      exerciseId,
      weights: [...list].sort((a, b) => a.date.localeCompare(b.date)).map((s) => s.kg),
    }))
}
