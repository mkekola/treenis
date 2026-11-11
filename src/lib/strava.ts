import { localDate } from '@/lib/session'
import {
  SPORT_KIND,
  SPORT_LABELS,
  type MeasuredData,
  type PendingMatch,
  type SportKey,
  type Workout,
} from '@/types/workout'

/**
 * Stravasta tuotu aktiviteetti sellaisena kuin palvelin sen tallentaa.
 * Palvelin vain tuo, sovellus yhdistää: puhelin näkee myös treenit, joita ei
 * ole vielä synkattu, joten yhdistäminen täällä ei tee tuplia.
 */
export interface StravaActivity {
  id: number
  /** Stravan sport_type, esim. "Run" tai "WeightTraining". */
  sportType: string
  name: string
  /** ISO-aikaleima UTC:nä. */
  startedAt: string
  elapsedSec: number
  movingSec?: number
  distanceM?: number
  avgHr?: number
  maxHr?: number
  calories?: number
  elevationGainM?: number
}

const SPORT_FROM_STRAVA: Record<string, SportKey> = {
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Ride: 'bike',
  MountainBikeRide: 'bike',
  GravelRide: 'bike',
  EBikeRide: 'bike',
  EMountainBikeRide: 'bike',
  VirtualRide: 'bike',
  Swim: 'swim',
  NordicSki: 'nordic',
  BackcountrySki: 'nordic',
  AlpineSki: 'alpine',
  Snowboard: 'alpine',
  IceSkate: 'skating',
  InlineSkate: 'skating',
  Hike: 'hike',
  Walk: 'walk',
  RockClimbing: 'climb',
  Windsurf: 'windsurf',
  Kitesurf: 'kitesurf',
  WeightTraining: 'strength',
  Crossfit: 'strength',
  Yoga: 'yoga',
  Pilates: 'pilates',
}

/** Stravan laji Treeniksen lajiksi. Tuntematon menee lajiin "Muu". */
export function sportFromStrava(sportType: string): SportKey {
  return SPORT_FROM_STRAVA[sportType] ?? 'other'
}

/**
 * Mitattu data aktiviteetista. Matkalajeissa kesto on liikkeelläoloaika, jotta
 * vauhti vastaa Stravaa. Muissa koko aika, koska salilla myös lepo kuuluu treeniin.
 */
export function measuredFrom(activity: StravaActivity): MeasuredData {
  const distance = SPORT_KIND[sportFromStrava(activity.sportType)] === 'distance'
  return {
    stravaActivityId: activity.id,
    startedAt: activity.startedAt,
    durationSec: distance ? (activity.movingSec ?? activity.elapsedSec) : activity.elapsedSec,
    ...(activity.distanceM ? { distanceM: activity.distanceM } : {}),
    ...(activity.avgHr ? { avgHr: activity.avgHr } : {}),
    ...(activity.maxHr ? { maxHr: activity.maxHr } : {}),
    ...(activity.calories ? { calories: activity.calories } : {}),
    ...(activity.elevationGainM ? { elevationGainM: activity.elevationGainM } : {}),
  }
}

/** Pelkästä aktiviteetista syntyvä treeni. Tunniste on kiinteä, jotta kaksi laitetta ei luo kahta. */
export function workoutFromActivity(activity: StravaActivity): Workout {
  return {
    id: stravaWorkoutId(activity.id),
    sport: sportFromStrava(activity.sportType),
    date: localDate(new Date(activity.startedAt)),
    title: activity.name,
    measured: measuredFrom(activity),
  }
}

/**
 * Aktiviteetista johdettu tunniste. Tietokanta vaatii UUID-muodon, joten
 * aktiviteetin numero kirjoitetaan UUID:n loppuosaan heksana: sama aktiviteetti
 * antaa aina saman tunnisteen.
 */
export function stravaWorkoutId(activityId: number): string {
  return `00000000-0000-4000-8000-${activityId.toString(16).padStart(12, '0')}`
}

export type Resolution =
  /** Selvä osuma: aktiviteetti yhdistyy kirjattuun treeniin itsestään. */
  | { kind: 'merge'; workoutId: string }
  /** Epävarma osuma: päiväkirjakortti kysyy, onko tämä sama treeni. */
  | { kind: 'pending'; workoutId: string }
  /** Ei kirjattua vastinetta: aktiviteetista tulee oma treeninsä. */
  | { kind: 'new' }
  /** Aktiviteetti on jo käsitelty. */
  | { kind: 'done' }

/** Selvässä osumassa aloitukset ovat korkeintaan näin kaukana toisistaan… */
const CLEAR_START_DIFF_SEC = 15 * 60
/** …tai ajat menevät päällekkäin vähintään näin suurelta osin lyhyemmästä. */
const CLEAR_OVERLAP = 0.5
/** Tätä kauempana alkaneet treenit eivät ole edes ehdokkaita. */
const RELATED_START_DIFF_SEC = 30 * 60

function interval(startedAt: string, durationSec: number): [number, number] {
  const start = Date.parse(startedAt) / 1000
  return [start, start + durationSec]
}

export function referencesActivity(workout: Workout, activityId: number): boolean {
  return (
    workout.id === stravaWorkoutId(activityId) ||
    workout.measured?.stravaActivityId === activityId ||
    workout.pendingMatch?.stravaActivityId === activityId
  )
}

/**
 * Päättää, mitä aktiviteetille tehdään. Ehdokkaita ovat kirjatut treenit,
 * joilla ei vielä ole mitattua puolta eikä avointa kysymystä ja jotka osuvat
 * samaan aikaan. Itsestään yhdistyy vain yksiselitteinen osuma: sama laji,
 * yksi ehdokas ja selvästi sama aika. Kaikki muu kysytään.
 */
export function resolveActivity(activity: StravaActivity, workouts: Workout[]): Resolution {
  if (workouts.some((w) => referencesActivity(w, activity.id))) return { kind: 'done' }

  const [aStart, aEnd] = interval(activity.startedAt, activity.elapsedSec)
  const sport = sportFromStrava(activity.sportType)

  const candidates = workouts
    .filter((w) => w.logged?.startedAt && !w.measured && !w.pendingMatch)
    .map((w) => {
      const [wStart, wEnd] = interval(w.logged!.startedAt!, w.logged?.durationSec ?? 0)
      const overlap = Math.max(0, Math.min(aEnd, wEnd) - Math.max(aStart, wStart))
      const shorter = Math.max(1, Math.min(aEnd - aStart, wEnd - wStart))
      return { workout: w, startDiff: Math.abs(aStart - wStart), overlapShare: overlap / shorter }
    })
    .filter((c) => c.overlapShare > 0 || c.startDiff <= RELATED_START_DIFF_SEC)
    .sort((a, b) => b.overlapShare - a.overlapShare || a.startDiff - b.startDiff)

  const best = candidates[0]
  if (!best) return { kind: 'new' }

  const clear =
    candidates.length === 1 &&
    best.workout.sport === sport &&
    (best.startDiff <= CLEAR_START_DIFF_SEC || best.overlapShare >= CLEAR_OVERLAP)
  return { kind: clear ? 'merge' : 'pending', workoutId: best.workout.id }
}

/** Mitä laitteen treeneille tehdään yhden aktiviteetin takia. */
export interface Reconciliation {
  save: Workout[]
  remove: string[]
}

const NOTHING: Reconciliation = { save: [], remove: [] }

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Sovittaa aktiviteetin laitteen treeneihin. Kutsutaan jokaiselle tuodulle
 * aktiviteetille, myös jo käsitellyille, joten tulos on sama vaikka ajo
 * toistuisi:
 *
 * - Jo yhdistetty: mitattu puoli päivitetään, jos aktiviteettia on muokattu Stravassa.
 * - Avoin kysymys: odotetaan käyttäjän vastausta.
 * - Pelkkä Strava-treeni on jo olemassa: pidetään, paitsi jos toinen laite on sillä
 *   välin synkannut kirjatun treenin, johon aktiviteetti selvästi kuuluu. Silloin
 *   yhdistetään ja tupla poistetaan. Epävarmaa osumaa ei kysytä uudelleen, koska
 *   pelkkä Strava-treeni syntyy myös siitä, että käyttäjä vastasi "ei sama".
 * - Käyttäjä on poistanut treenin, johon aktiviteetti kuului: ei luoda uudelleen.
 * - Muuten resolveActivity päättää.
 */
export function reconcile(
  activity: StravaActivity,
  workouts: Workout[],
  options: { deleted?: boolean; removed?: Workout[] } = {},
): Reconciliation {
  const ownId = stravaWorkoutId(activity.id)
  const own = workouts.find((w) => w.id === ownId && !w.logged)
  if (options.deleted) return own ? { save: [], remove: [ownId] } : NOTHING
  if (options.removed?.some((w) => referencesActivity(w, activity.id))) return NOTHING

  const measured = measuredFrom(activity)
  const linked = workouts.find((w) => w.id !== ownId && w.measured?.stravaActivityId === activity.id)
  if (linked) {
    return {
      save: same(linked.measured, measured) ? [] : [{ ...linked, measured }],
      remove: own ? [ownId] : [],
    }
  }
  if (workouts.some((w) => w.pendingMatch?.stravaActivityId === activity.id)) return NOTHING

  const resolution = resolveActivity(
    activity,
    workouts.filter((w) => w.id !== ownId),
  )
  if (resolution.kind === 'merge') {
    const target = workouts.find((w) => w.id === resolution.workoutId)!
    return { save: [{ ...target, measured }], remove: own ? [ownId] : [] }
  }
  if (own) {
    const fresh = workoutFromActivity(activity)
    const changed = !same(
      [own.sport, own.date, own.title, own.measured],
      [fresh.sport, fresh.date, fresh.title, fresh.measured],
    )
    return changed ? { save: [{ ...own, ...fresh }], remove: [] } : NOTHING
  }
  if (resolution.kind === 'pending') {
    const target = workouts.find((w) => w.id === resolution.workoutId)!
    return { save: [{ ...target, pendingMatch: pendingFrom(activity) }], remove: [] }
  }
  return { save: [workoutFromActivity(activity)], remove: [] }
}

/** Kysymyksen tiedot päiväkirjakorttiin: laji suomeksi, alkuaika ja kesto. */
export function pendingFrom(activity: StravaActivity): PendingMatch {
  return {
    stravaActivityId: activity.id,
    startedAt: activity.startedAt,
    durationSec: measuredFrom(activity).durationSec,
    stravaSportName: SPORT_LABELS[sportFromStrava(activity.sportType)],
  }
}
