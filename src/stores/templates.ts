import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, plain } from '@/db'
import type { WorkoutTemplate } from '@/types/workout'

export const useTemplates = defineStore('templates', () => {
  /** Käytössä olevat pohjat. Poistetut ovat vain tietokannassa merkintöinä. */
  const templates = ref<WorkoutTemplate[]>([])

  async function load() {
    templates.value = (await db.templates.toArray()).filter((t) => !t.deletedAt)
  }

  function upsertInList(template: WorkoutTemplate) {
    if (template.deletedAt) {
      templates.value = templates.value.filter((t) => t.id !== template.id)
      return
    }
    const index = templates.value.findIndex((t) => t.id === template.id)
    if (index === -1) templates.value.push(template)
    else templates.value[index] = template
  }

  /** Tallentaa laitteelle ja lähetysjonoon samassa transaktiossa, kuten treenit. */
  async function save(template: WorkoutTemplate) {
    const saved = { ...template, updatedAt: new Date().toISOString() }
    await db.transaction('rw', db.templates, db.outbox, async () => {
      await db.templates.put(plain(saved))
      await db.outbox.put({ id: saved.id, kind: 'template', updatedAt: saved.updatedAt })
    })
    upsertInList(saved)
  }

  /** Poisto on tallennus poistomerkinnällä, jotta se välittyy muille laitteille. */
  async function remove(id: string) {
    const template = await db.templates.get(id)
    if (template) await save({ ...template, deletedAt: new Date().toISOString() })
  }

  /** Palvelimelta tullut versio. Ei mene jonoon, koska se on jo palvelimella. */
  async function applyRemote(template: WorkoutTemplate) {
    await db.templates.put(plain(template))
    upsertInList(template)
  }

  async function removeLocal(id: string) {
    await db.templates.delete(id)
    templates.value = templates.value.filter((t) => t.id !== id)
  }

  return { templates, load, save, remove, applyRemote, removeLocal }
})
