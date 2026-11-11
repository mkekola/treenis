import type { Measurement, SetEntry, SportKey, Workout } from '@/types/workout'
import { avgHr, distanceM, durationSec, kindOf, totalVolumeKg } from '@/lib/workout'

/** Kapea sitova välilyönti: luku ja yksikkö eivät rivity erilleen. */
const NBSP_THIN = '\u202F'

function fi(n: number, decimals = 0): string {
  return n.toLocaleString('fi-FI', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

/** 3725 → "1.02.05", 2530 → "42.10". Suomalainen aikamerkintä pisteillä. */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.round(sec % 60)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}.${pad(m)}.${pad(s)}` : `${m}.${pad(s)}`
}

/** Lyhyt kesto listoihin: "58 min", "1 t 19 min". */
export function formatDurationShort(sec: number): string {
  return durationParts(sec)
    .map((part) => `${part.value}${NBSP_THIN}${part.unit}`)
    .join(' ')
}

/**
 * Kesto osina, jotta näkymä voi näyttää yksiköt pienempinä kuin luvut.
 * Tasatunnista jää minuutit pois: "1 t", ei "1 t 0 min".
 */
export function durationParts(sec: number): { value: number; unit: 't' | 'min' }[] {
  const totalMin = Math.round(sec / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return [{ value: m, unit: 'min' }]
  return m === 0 ? [{ value: h, unit: 't' }] : [{ value: h, unit: 't' }, { value: m, unit: 'min' }]
}

/** Uinti metreinä, muut kilometreinä. */
export function formatDistance(sport: SportKey, meters: number): string {
  if (sport === 'swim') return `${fi(meters)}${NBSP_THIN}m`
  return `${fi(meters / 1000, 2)}${NBSP_THIN}km`
}

/** Juoksu min/km, uinti min/100 m, pyöräily km/h. */
export function formatPace(sport: SportKey, meters: number, sec: number): string | null {
  if (meters <= 0 || sec <= 0) return null

  if (sport === 'bike') {
    const kmh = meters / 1000 / (sec / 3600)
    return `${fi(kmh, 1)}${NBSP_THIN}km/h`
  }

  const perUnit = sport === 'swim' ? 100 : 1000
  const label = sport === 'swim' ? `/100${NBSP_THIN}m` : '/km'
  const secPerUnit = sec / (meters / perUnit)
  const m = Math.floor(secPerUnit / 60)
  const s = Math.round(secPerUnit % 60)
  return `${m}.${String(s).padStart(2, '0')}${NBSP_THIN}${label}`
}

export function formatVolume(kg: number): string {
  return `${fi(Math.round(kg))}${NBSP_THIN}kg`
}

/** "ke 12.11." */
export function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  const weekday = d.toLocaleDateString('fi-FI', { weekday: 'short' }).replace('.', '')
  return `${weekday} ${d.getDate()}.${d.getMonth() + 1}.`
}

/** "17.28" */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Kortilla näytettävät luvut lajin luonteen mukaan. Matka ja syke tulevat
 * mittauksesta, tilavuus ja rasitus omasta kirjauksesta.
 */
export function workoutMetrics(workout: Workout): string[] {
  const metrics: string[] = []
  const seconds = durationSec(workout)
  const meters = distanceM(workout)
  const kind = kindOf(workout)

  if (kind === 'distance' && meters) {
    metrics.push(formatDistance(workout.sport, meters))
    metrics.push(formatDuration(seconds))
    const pace = formatPace(workout.sport, meters, seconds)
    if (pace) metrics.push(pace)
  } else if (seconds > 0) {
    metrics.push(formatDurationShort(seconds))
  }

  if (kind === 'strength') {
    const volume = totalVolumeKg(workout)
    if (volume > 0) metrics.push(formatVolume(volume))
  }

  const hr = avgHr(workout)
  if (hr) metrics.push(`${hr}${NBSP_THIN}bpm`)

  const rpe = workout.logged?.rpe
  if (rpe) metrics.push(`rasitus ${rpe}`)

  return metrics
}

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })

/** Sarja lyhyesti: "42,5 × 8", toistoliikkeessä "10", aikaliikkeessä "45 s". */
export function formatSet(set: SetEntry, measurement: Measurement): string {
  if (measurement === 'time') return `${set.durationSec ?? 0}${NBSP_THIN}s`
  if (measurement === 'reps') return `${set.reps ?? 0}`
  return `${kgFormat.format(set.weightKg ?? 0)} × ${set.reps ?? 0}`
}

