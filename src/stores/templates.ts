import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, plain } from '@/db'
import type { WorkoutTemplate } from '@/types/workout'

export const useTemplates = defineStore('templates', () => {
  const templates = ref<WorkoutTemplate[]>([])

  async function load() {
    templates.value = await db.templates.toArray()
  }

  async function save(template: WorkoutTemplate) {
    await db.templates.put(plain(template))
    const index = templates.value.findIndex((t) => t.id === template.id)
    if (index === -1) templates.value.push(template)
    else templates.value[index] = template
  }

  return { templates, load, save }
})
