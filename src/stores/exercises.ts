import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary'
import { db, plain } from '@/db'
import { normalize, searchExercises } from '@/lib/exerciseSearch'
import type { Exercise, Measurement, MuscleGroup } from '@/types/workout'

export interface NewExercise {
  name: string
  muscleGroup: MuscleGroup
  measurement: Measurement
  perSide: boolean
}

export const useExercises = defineStore('exercises', () => {
  const custom = ref<Exercise[]>([])

  async function load() {
    custom.value = await db.customExercises.toArray()
  }

  const all = computed(() => [...EXERCISE_LIBRARY, ...custom.value])

  const byId = computed(() => new Map(all.value.map((exercise) => [exercise.id, exercise])))

  function search(query: string): Exercise[] {
    return searchExercises(query, all.value)
  }

  /** Samannimistä liikettä ei lisätä kahdesti, vaan palautetaan jo olemassa oleva. */
  function findByName(name: string): Exercise | undefined {
    const target = normalize(name)
    return all.value.find((exercise) => normalize(exercise.name) === target)
  }

  /**
   * Liike on käytettävissä heti. Tallennus laitteelle ja lähetysjonoon jatkuu
   * taustalla, joten liikkeen valinta ei odota tietokantaa. Liike lähtee
   * palvelimelle seuraavassa synkassa, viimeistään kun treeni tallennetaan.
   */
  function addCustom(input: NewExercise): Exercise {
    const existing = findByName(input.name)
    if (existing) return existing

    const exercise: Exercise = {
      id: `custom-${crypto.randomUUID()}`,
      name: input.name.trim(),
      muscleGroup: input.muscleGroup,
      measurement: input.measurement,
      perSide: input.perSide,
      aliases: [],
      custom: true,
      updatedAt: new Date().toISOString(),
    }
    custom.value = [...custom.value, exercise]
    void persist(exercise)
    return exercise
  }

  async function persist(exercise: Exercise) {
    await db.transaction('rw', db.customExercises, db.outbox, async () => {
      await db.customExercises.put(plain(exercise))
      await db.outbox.put({ id: exercise.id, kind: 'exercise', updatedAt: exercise.updatedAt! })
    })
  }

  /** Palvelimelta tullut versio. Ei mene jonoon, koska se on jo palvelimella. */
  async function applyRemote(exercise: Exercise) {
    await db.customExercises.put(plain(exercise))
    const index = custom.value.findIndex((e) => e.id === exercise.id)
    if (index === -1) custom.value = [...custom.value, exercise]
    else custom.value = custom.value.map((e) => (e.id === exercise.id ? exercise : e))
  }

  async function removeLocal(id: string) {
    await db.customExercises.delete(id)
    custom.value = custom.value.filter((e) => e.id !== id)
  }

  return { all, byId, search, findByName, load, addCustom, applyRemote, removeLocal }
})
