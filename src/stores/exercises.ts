import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary'
import { normalize, searchExercises } from '@/lib/exerciseSearch'
import type { Exercise, Measurement, MuscleGroup } from '@/types/workout'

const STORAGE_KEY = 'treenis.customExercises'

function load(): Exercise[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Exercise[]) : []
  } catch {
    // Safari voi estää tai tyhjentää tallennustilan. Omat liikkeet ovat silloin tyhjät.
    return []
  }
}

export interface NewExercise {
  name: string
  muscleGroup: MuscleGroup
  measurement: Measurement
  perSide: boolean
}

export const useExercises = defineStore('exercises', () => {
  const custom = ref<Exercise[]>(load())

  watch(
    custom,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Tallennus saa epäonnistua hiljaa.
      }
    },
    { deep: true },
  )

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
    }
    custom.value = [...custom.value, exercise]
    return exercise
  }

  return { all, byId, search, findByName, addCustom }
})
