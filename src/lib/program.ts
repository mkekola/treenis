import type { Program, WorkoutTemplate } from '@/types/workout'

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
