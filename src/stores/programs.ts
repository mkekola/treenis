import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { db, plain } from '@/db'
import { activate, activeProgram, addTemplate, removeTemplate } from '@/lib/program'
import { newTemplate } from '@/lib/template'
import { useTemplates } from '@/stores/templates'
import type { Program, WorkoutTemplate } from '@/types/workout'

export const usePrograms = defineStore('programs', () => {
  const templates = useTemplates()

  /** Ohjelmat ilman poistettuja. Poistetut ovat vain tietokannassa merkintöinä. */
  const programs = ref<Program[]>([])

  const active = computed(() => activeProgram(programs.value))

  async function load() {
    programs.value = (await db.programs.toArray()).filter((p) => !p.deletedAt)
  }

  function upsertInList(program: Program) {
    if (program.deletedAt) {
      programs.value = programs.value.filter((p) => p.id !== program.id)
      return
    }
    const index = programs.value.findIndex((p) => p.id === program.id)
    if (index === -1) programs.value.push(program)
    else programs.value[index] = program
  }

  /** Tallentaa laitteelle ja lähetysjonoon samassa transaktiossa, kuten treenit. */
  async function save(program: Program) {
    const saved = { ...program, updatedAt: new Date().toISOString() }
    await db.transaction('rw', db.programs, db.outbox, async () => {
      await db.programs.put(plain(saved))
      await db.outbox.put({ id: saved.id, kind: 'program', updatedAt: saved.updatedAt })
    })
    upsertInList(saved)
  }

  const byId = (id: string) => programs.value.find((p) => p.id === id)

  /** Ohjelma, johon treeni kuuluu. Treeni kuuluu aina korkeintaan yhteen. */
  const ownerOf = (templateId: string) =>
    programs.value.find((p) => p.templateIds.includes(templateId))

  async function create(name: string): Promise<Program> {
    const program: Program = { id: `program-${crypto.randomUUID()}`, name, templateIds: [] }
    await save(program)
    return program
  }

  async function makeActive(id: string) {
    const program = byId(id)
    if (program) await save(activate(program, new Date()))
  }

  /** Lisää valmiin treenin ohjelman loppuun. */
  async function addTemplateTo(programId: string, template: WorkoutTemplate) {
    const program = byId(programId)
    if (!program) return
    await templates.save(template)
    await save(addTemplate(program, template.id))
  }

  /** Seuraava vapaa oletusnimi ohjelmassa: Treeni 1, Treeni 2 … */
  function nextTemplateName(programId: string): string {
    return `Treeni ${(byId(programId)?.templateIds.length ?? 0) + 1}`
  }

  /** Uusi tyhjä treeni ohjelman loppuun. Palauttaa treenin tunnisteen muokkausta varten. */
  async function createTemplate(programId: string): Promise<string | null> {
    if (!byId(programId)) return null
    const template = newTemplate(`template-${crypto.randomUUID()}`, nextTemplateName(programId))
    await addTemplateTo(programId, template)
    return template.id
  }

  async function deleteTemplate(templateId: string) {
    const owner = ownerOf(templateId)
    if (owner) await save(removeTemplate(owner, templateId))
    await templates.remove(templateId)
  }

  /** Ohjelman poisto vie sen treenit mukanaan, koska treeni ei elä ilman ohjelmaa. */
  async function remove(id: string) {
    const program = byId(id)
    if (!program) return
    for (const templateId of program.templateIds) await templates.remove(templateId)
    await save({ ...program, deletedAt: new Date().toISOString() })
  }

  /** Palvelimelta tullut versio. Ei mene jonoon, koska se on jo palvelimella. */
  async function applyRemote(program: Program) {
    await db.programs.put(plain(program))
    upsertInList(program)
  }

  async function removeLocal(id: string) {
    await db.programs.delete(id)
    programs.value = programs.value.filter((p) => p.id !== id)
  }

  return {
    programs,
    active,
    load,
    save,
    byId,
    ownerOf,
    create,
    makeActive,
    addTemplateTo,
    nextTemplateName,
    createTemplate,
    deleteTemplate,
    remove,
    applyRemote,
    removeLocal,
  }
})
