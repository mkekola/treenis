import { totalVolumeKg } from '@/lib/workout'
import type { Program, Workout, WorkoutTemplate } from '@/types/workout'

/** Kiinteä tunniste ensimmäiselle ohjelmalle, jotta jokainen laite luo saman eikä kopioita synny. */
export const DEFAULT_PROGRAM_ID = 'program-default'
export const DEFAULT_PROGRAM_NAME = 'Koko kroppa 2krt/vko'

/**
 * Käytössä on viimeksi käyttöön otettu ohjelma. Aikaleimat vertaillaan
 * lukuina, koska palvelimen muoto (+00:00) ja selaimen muoto (Z) eroavat.
 */
export function activeProgram(programs: Program[]): Program | undefined {
  let latest: Program | undefined
  for (const p of programs) {
    if (!p.activatedAt) continue
    if (!latest || Date.parse(p.activatedAt) > Date.parse(latest.activatedAt!)) latest = p
  }
  return latest
}

export function activate(program: Program, now: Date): Program {
  return { ...program, activatedAt: now.toISOString() }
}

export function addTemplate(program: Program, templateId: string): Program {
  if (program.templateIds.includes(templateId)) return program
  return { ...program, templateIds: [...program.templateIds, templateId] }
}

export function removeTemplate(program: Program, templateId: string): Program {
  return { ...program, templateIds: program.templateIds.filter((id) => id !== templateId) }
}

/** Ohjelman treenit sen omassa järjestyksessä. Puuttuvat (esim. synkka kesken) ohitetaan. */
export function templatesOf(program: Program, templates: WorkoutTemplate[]): WorkoutTemplate[] {
  const byId = new Map(templates.map((t) => [t.id, t]))
  return program.templateIds
    .map((id) => byId.get(id))
    .filter((t): t is WorkoutTemplate => t !== undefined)
}

/** Treenit, joita mikään ohjelma ei sisällä. Voi syntyä hetkeksi, kun synkka on kesken. */
export function unassigned(programs: Program[], templates: WorkoutTemplate[]): WorkoutTemplate[] {
  const assigned = new Set(programs.flatMap((p) => p.templateIds))
  return templates.filter((t) => !assigned.has(t.id))
}

/**
 * Vuorottelu: seuraavaksi ehdotetaan treeniä, jota ei ole tehty pisimpään.
 * Tekemättömät ensin ohjelman järjestyksessä. Näin A → B → A kulkee itsestään.
 */
export function inRotation(templates: WorkoutTemplate[]): WorkoutTemplate[] {
  return templates
    .map((template, index) => ({ template, index }))
    .sort(
      (a, b) =>
        (a.template.lastUsedAt ?? '').localeCompare(b.template.lastUsedAt ?? '') || a.index - b.index,
    )
    .map(({ template }) => template)
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface ProgramProgress {
  /** Monesko viikko käyttöönotosta, alkaen ykkösestä. */
  week: number
  /** Ohjelman kesto, jos se on annettu. */
  totalWeeks?: number
  /** Ohjelman treeneistä tehdyt kerrat käyttöönoton jälkeen. */
  done: number
  /** Suunnitellut kerrat koko ohjelmalle: treenien määrä × viikot. Vain kun kesto on annettu. */
  planned?: number
  volumeKg: number
}

/**
 * Käytössä olevan ohjelman edistyminen. Viikot lasketaan käyttöönotosta, ja
 * mukaan lasketaan vain ohjelman omista pohjista aloitetut treenit.
 */
export function programProgress(program: Program, workouts: Workout[], now: Date): ProgramProgress | null {
  if (!program.activatedAt) return null
  const start = Date.parse(program.activatedAt)
  const week = Math.max(1, Math.floor((now.getTime() - start) / (7 * DAY_MS)) + 1)
  const ids = new Set(program.templateIds)
  const own = workouts.filter((w) => {
    const startedAt = w.logged?.startedAt ?? `${w.date}T12:00:00`
    return w.templateId !== undefined && ids.has(w.templateId) && Date.parse(startedAt) >= start
  })
  const weeks = program.durationWeeks
  return {
    week: weeks ? Math.min(week, weeks) : week,
    ...(weeks ? { totalWeeks: weeks, planned: program.templateIds.length * weeks } : {}),
    done: own.length,
    volumeKg: own.reduce((sum, w) => sum + totalVolumeKg(w), 0),
  }
}
