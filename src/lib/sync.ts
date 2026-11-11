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
  updated_at: string
  deleted_at: string | null
}

export function templateToRow(t: WorkoutTemplate): TemplateRow {
  return {
    id: t.id,
    name: t.name,
    blocks: t.blocks,
    last_used_at: t.lastUsedAt ?? null,
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
