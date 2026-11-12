import { localDate } from '@/lib/session'
import { SPORT_KIND, SPORT_LABELS, type SportKey, type Workout } from '@/types/workout'

/**
 * Käsin kirjattu treeni lomakkeelta: muut lajit kuin sali, vanhat treenit
 * menneelle päivälle sekä tallennetun treenin muokkaus. Lomake käsittelee
 * arvoja tässä muodossa, ja nämä funktiot kääntävät ne treeniksi ja takaisin.
 */
export interface ManualInput {
  sport: SportKey
  title: string
  /** 2026-11-12 */
  date: string
  /** "17:30" tai tyhjä. Alkamisaika auttaa yhdistämään saman treenin Stravasta. */
  startTime: string
  durationSec: number
  distanceM?: number
  avgHr?: number
  rpe?: number
  notes: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "17:30" ISO-aikaleimasta paikallisena aikana. */
export function timeOf(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Päivä ja paikallinen kellonaika ISO-aikaleimaksi, tai undefined ilman aikaa. */
export function startedAtOf(date: string, time: string): string | undefined {
  if (!/^\d{1,2}[:.]\d{2}$/.test(time.trim())) return undefined
  const [h, m] = time.trim().split(/[:.]/).map(Number)
  return new Date(`${date}T${pad(h)}:${pad(m)}:00`).toISOString()
}

/** Matka tekstistä: "8,24" km → 8240 m. Uinti kirjataan metreinä. */
export function parseDistance(text: string, sport: SportKey): number | undefined {
  const value = Number(text.replace(',', '.').trim())
  if (!text.trim() || !Number.isFinite(value) || value <= 0) return undefined
  return Math.round(sport === 'swim' ? value : value * 1000)
}

/** Uuden kirjauksen oletukset: tämä päivä, ja tänään alkamisaika on "nyt miinus kesto". */
export function newInput(sport: SportKey, now: Date): ManualInput {
  return {
    sport,
    title: SPORT_LABELS[sport],
    date: localDate(now),
    startTime: '',
    durationSec: 0,
    notes: '',
  }
}

/** Ehdotus alkamisajaksi tälle päivälle: nyt miinus kesto. Menneelle päivälle ei arvata. */
export function suggestedStart(date: string, durationSec: number, now: Date): string {
  if (date !== localDate(now)) return ''
  return timeOf(new Date(now.getTime() - durationSec * 1000).toISOString())
}

export function isComplete(input: ManualInput, today: string): boolean {
  return input.durationSec > 0 && input.date <= today
}

/** Uusi käsin kirjattu treeni. */
export function manualWorkout(id: string, input: ManualInput): Workout {
  const distance = SPORT_KIND[input.sport] === 'distance'
  return {
    id,
    sport: input.sport,
    date: input.date,
    title: input.title.trim() || SPORT_LABELS[input.sport],
    logged: {
      startedAt: startedAtOf(input.date, input.startTime),
      durationSec: input.durationSec,
      ...(distance && input.distanceM ? { distanceM: input.distanceM } : {}),
      ...(distance && input.avgHr ? { avgHr: input.avgHr } : {}),
      ...(input.rpe ? { rpe: input.rpe } : {}),
      ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
    },
  }
}

/** Lomakkeen arvot tallennetusta treenistä, muokkausta varten. */
export function inputFromWorkout(workout: Workout): ManualInput {
  const startedAt = workout.measured?.startedAt ?? workout.logged?.startedAt
  return {
    sport: workout.sport,
    title: workout.title,
    date: workout.date,
    startTime: startedAt ? timeOf(startedAt) : '',
    durationSec: workout.measured?.durationSec ?? workout.logged?.durationSec ?? 0,
    distanceM: workout.measured?.distanceM ?? workout.logged?.distanceM,
    avgHr: workout.measured?.avgHr ?? workout.logged?.avgHr,
    rpe: workout.logged?.rpe,
    notes: workout.logged?.notes ?? '',
  }
}

/**
 * Kopio uuden treenin pohjaksi: samat tiedot, mutta päivä on tämä päivä eikä
 * alkamisaikaa arvata, koska kopioitu treeni tehtiin eri aikaan.
 */
export function copyInput(workout: Workout, now: Date): ManualInput {
  return { ...inputFromWorkout(workout), date: localDate(now), startTime: '' }
}

/**
 * Muokkaus tallennettuun treeniin. Kellon mittaamiin arvoihin (aika, kesto,
 * matka, syke) ei kosketa, koska mitattu voittaa kirjatun. Salitreenin sarjat
 * säilyvät ennallaan.
 */
export function applyEdit(workout: Workout, input: ManualInput): Workout {
  const measured = workout.measured !== undefined
  const distance = SPORT_KIND[workout.sport] === 'distance'
  const logged = { ...workout.logged }
  if (!measured) {
    logged.startedAt = startedAtOf(input.date, input.startTime)
    logged.durationSec = input.durationSec
    if (distance) {
      logged.distanceM = input.distanceM
      logged.avgHr = input.avgHr
    }
  }
  logged.rpe = input.rpe
  logged.notes = input.notes.trim() || undefined
  return {
    ...workout,
    title: input.title.trim() || SPORT_LABELS[workout.sport],
    date: input.date,
    logged,
  }
}
