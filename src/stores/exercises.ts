import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary'
import { MUSCLE_GROUP_OF } from '@/data/exerciseMuscles'
import { db, plain } from '@/db'
import { normalize, searchExercises } from '@/lib/exerciseSearch'
import { pinsOutboxId } from '@/lib/sync'
import type { Exercise, Measurement, Muscle, SubstitutePins } from '@/types/workout'

export interface NewExercise {
  name: string
  /** Päälihakset. Tyhjä: koko kehon liike. */
  muscles: Muscle[]
  measurement: Measurement
  perSide: boolean
}

export const useExercises = defineStore('exercises', () => {
  const custom = ref<Exercise[]>([])
  /** Kiinnitetyt korvaavat liikkeet liikkeittäin. */
  const pins = ref(new Map<string, SubstitutePins>())

  async function load() {
    custom.value = await db.customExercises.toArray()
    pins.value = new Map((await db.substitutePins.toArray()).map((p) => [p.exerciseId, p]))
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
      // Lihasryhmä näkyy liikelistassa, joten se johdetaan ensimmäisestä lihaksesta.
      muscleGroup: input.muscles[0] ? MUSCLE_GROUP_OF[input.muscles[0]] : 'full_body',
      muscles: input.muscles,
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

  function pinnedFor(exerciseId: string): string[] {
    return pins.value.get(exerciseId)?.substituteIds ?? []
  }

  /** Kiinnittää korvaajan tai irrottaa kiinnitetyn. Näkyy heti, ennen kuin tallennus on valmis. */
  async function togglePin(exerciseId: string, substituteId: string) {
    const current = pinnedFor(exerciseId)
    const substituteIds = current.includes(substituteId)
      ? current.filter((id) => id !== substituteId)
      : [...current, substituteId]
    const next: SubstitutePins = { exerciseId, substituteIds, updatedAt: new Date().toISOString() }
    pins.value = new Map(pins.value).set(exerciseId, next)
    await db.transaction('rw', db.substitutePins, db.outbox, async () => {
      await db.substitutePins.put(plain(next))
      await db.outbox.put({ id: pinsOutboxId(exerciseId), kind: 'substitutes', updatedAt: next.updatedAt })
    })
  }

  async function applyRemotePins(remote: SubstitutePins) {
    await db.substitutePins.put(plain(remote))
    pins.value = new Map(pins.value).set(remote.exerciseId, remote)
  }

  return {
    all,
    custom,
    byId,
    pins,
    search,
    findByName,
    load,
    addCustom,
    applyRemote,
    removeLocal,
    pinnedFor,
    togglePin,
    applyRemotePins,
  }
})
