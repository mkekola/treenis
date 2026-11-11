import type { StravaActivity } from '@/lib/strava'
import type {
  Block,
  Exercise,
  Measurement,
  MuscleGroup,
  Program,
  ProgramLevel,
  Workout,
  WorkoutTemplate,
} from '@/types/workout'

/** Palvelimen versio: aina aikaleima, ja poistettu rivi tulee merkintänä. */
export interface Synced {
  updatedAt: string
  deletedAt?: string
}

export type RemoteWorkout = Workout & Synced

export type RemoteAction = 'put' | 'delete' | 'skip'

/**
 * Mitä palvelimelta tullut versio tekee laitteen rivelle. Uusin versio
 * voittaa. Jonossa odottavaa omaa muutosta ei korvata: se lähetetään ensin,
 * ja palvelimen versio jää voimaan vain jos se on uudempi.
 */
export function remoteAction(
  remote: Synced,
  local: { updatedAt?: string } | undefined,
  pending: boolean,
): RemoteAction {
  if (pending) return 'skip'
  if (local?.updatedAt && Date.parse(local.updatedAt) >= Date.parse(remote.updatedAt)) {
    return 'skip'
  }
  if (remote.deletedAt) return local ? 'delete' : 'skip'
  return 'put'
}

/** Seuraavan haun alkukohta: uusin palvelimelta nähty muutos. */
export function latestUpdate(remotes: Synced[], previous: string | null): string | null {
  return remotes.reduce<string | null>(
    (latest, r) => (latest === null || Date.parse(r.updatedAt) > Date.parse(latest) ? r.updatedAt : latest),
    previous,
  )
}

/** Palvelimen muoto sisältää poistomerkinnän, jota laite ei tallenna. */
export function toLocal<T extends Synced>(remote: T): Omit<T, 'deletedAt'> {
  const { deletedAt: _deleted, ...rest } = remote
  return rest
}

// Pohjat ja omat liikkeet ovat tauluissa sellaisinaan, joten sovelluksen ja
// tietokannan nimet käännetään suoraan (camelCase ↔ snake_case).

export interface TemplateRow {
  id: string
  name: string
  blocks: Block[]
  last_used_at: string | null
  kept_deviations: string[]
  updated_at: string
  deleted_at: string | null
}

export function templateToRow(t: WorkoutTemplate): TemplateRow {
  return {
    id: t.id,
    name: t.name,
    blocks: t.blocks,
    last_used_at: t.lastUsedAt ?? null,
    kept_deviations: t.keptDeviations ?? [],
    updated_at: t.updatedAt ?? new Date().toISOString(),
    deleted_at: t.deletedAt ?? null,
  }
}

export function templateFromRow(row: TemplateRow): WorkoutTemplate & Synced {
  return {
    id: row.id,
    name: row.name,
    blocks: row.blocks,
    ...(row.last_used_at ? { lastUsedAt: row.last_used_at } : {}),
    ...(row.kept_deviations?.length ? { keptDeviations: row.kept_deviations } : {}),
    updatedAt: row.updated_at,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  }
}

export interface ExerciseRow {
  id: string
  name: string
  muscle_group: MuscleGroup
  measurement: Measurement
  per_side: boolean
  aliases: string[]
  weight_step_kg: number | null
  updated_at: string
  deleted_at: string | null
}

export function exerciseToRow(e: Exercise): Omit<ExerciseRow, 'deleted_at'> {
  return {
    id: e.id,
    name: e.name,
    muscle_group: e.muscleGroup,
    measurement: e.measurement,
    per_side: e.perSide,
    aliases: e.aliases,
    weight_step_kg: e.weightStepKg ?? null,
    updated_at: e.updatedAt ?? new Date().toISOString(),
  }
}

export function exerciseFromRow(row: ExerciseRow): Exercise & Synced {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    measurement: row.measurement,
    perSide: row.per_side,
    aliases: row.aliases,
    custom: true,
    ...(row.weight_step_kg !== null ? { weightStepKg: row.weight_step_kg } : {}),
    updatedAt: row.updated_at,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  }
}

export interface ProgramRow {
  id: string
  name: string
  template_ids: string[]
  color: string | null
  duration_weeks: number | null
  level: ProgramLevel | null
  activated_at: string | null
  updated_at: string
  deleted_at: string | null
}

export function programToRow(p: Program): ProgramRow {
  return {
    id: p.id,
    name: p.name,
    template_ids: p.templateIds,
    color: p.color ?? null,
    duration_weeks: p.durationWeeks ?? null,
    level: p.level ?? null,
    activated_at: p.activatedAt ?? null,
    updated_at: p.updatedAt ?? new Date().toISOString(),
    deleted_at: p.deletedAt ?? null,
  }
}

export function programFromRow(row: ProgramRow): Program & Synced {
  return {
    id: row.id,
    name: row.name,
    templateIds: row.template_ids,
    ...(row.color ? { color: row.color } : {}),
    ...(row.duration_weeks !== null ? { durationWeeks: row.duration_weeks } : {}),
    ...(row.level ? { level: row.level } : {}),
    ...(row.activated_at ? { activatedAt: row.activated_at } : {}),
    updatedAt: row.updated_at,
    ...(row.deleted_at ? { deletedAt: row.deleted_at } : {}),
  }
}

export interface PushResult {
  /** Palvelimella oli jokin uudempi versio, joten seuraava haku hakee kaiken. */
  serverWasNewer: boolean
  /** Palvelimen hylkäämät rivit. Ne jäävät jonoon ja yritetään seuraavalla kerralla. */
  failed: number
}

/**
 * Purkaa lähetysjonon rivi kerrallaan. Palvelimen hylkäämä rivi ohitetaan,
 * jotta yksi ongelma ei pysäytä muita: muut treenit pääsevät silti perille.
 * Verkon katkeaminen sen sijaan lopettaa purkamisen heti, koska silloin
 * kaikki loputkin epäonnistuisivat.
 */
export async function pushAll<T>(
  entries: T[],
  send: (entry: T) => Promise<boolean>,
  done: (entry: T) => Promise<void>,
  isOffline: () => boolean,
): Promise<PushResult> {
  let serverWasNewer = false
  let failed = 0
  for (const entry of entries) {
    try {
      if (!(await send(entry))) serverWasNewer = true
      await done(entry)
    } catch (error) {
      if (isOffline()) throw error
      failed += 1
    }
  }
  return { serverWasNewer, failed }
}

export interface StravaActivityRow {
  id: number
  sport_type: string
  name: string
  started_at: string
  elapsed_sec: number
  moving_sec: number | null
  distance_m: number | null
  avg_hr: number | null
  max_hr: number | null
  calories: number | null
  elevation_gain_m: number | null
  updated_at: string
  deleted_at: string | null
}

/** Palvelimen rivi aktiviteetiksi. Tyhjät kentät jäävät pois kokonaan. */
export function stravaActivityFromRow(row: StravaActivityRow): StravaActivity {
  const optional = (key: keyof StravaActivity, value: number | null) =>
    value !== null ? { [key]: value } : {}
  return {
    id: row.id,
    sportType: row.sport_type,
    name: row.name,
    startedAt: row.started_at,
    elapsedSec: row.elapsed_sec,
    ...optional('movingSec', row.moving_sec),
    ...optional('distanceM', row.distance_m),
    ...optional('avgHr', row.avg_hr),
    ...optional('maxHr', row.max_hr),
    ...optional('calories', row.calories),
    ...optional('elevationGainM', row.elevation_gain_m),
  }
}
