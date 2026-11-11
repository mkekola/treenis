import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, plain } from '@/db'
import type { Workout } from '@/types/workout'

export const useWorkouts = defineStore('workouts', () => {
  const workouts = ref<Workout[]>([])

  async function load() {
    workouts.value = await db.workouts.toArray()
  }

  function upsertInList(workout: Workout) {
    const index = workouts.value.findIndex((w) => w.id === workout.id)
    if (index === -1) workouts.value.push(workout)
    else workouts.value[index] = workout
  }

  /**
   * Tallentaa laitteelle ja laittaa lähetysjonoon samassa transaktiossa, jotta
   * yksikään muutos ei jää lähettämättä. Lista päivittyy heti, verkkoa ei odoteta.
   */
  async function save(workout: Workout) {
    const saved = { ...workout, updatedAt: new Date().toISOString() }
    await db.transaction('rw', db.workouts, db.outbox, async () => {
      await db.workouts.put(plain(saved))
      await db.outbox.put({ id: saved.id, kind: 'workout', updatedAt: saved.updatedAt })
    })
    upsertInList(saved)
  }

  /** Palvelimelta tullut versio. Ei mene jonoon, koska se on jo palvelimella. */
  async function applyRemote(workout: Workout) {
    await db.workouts.put(plain(workout))
    upsertInList(workout)
  }

  async function removeLocal(id: string) {
    await db.workouts.delete(id)
    workouts.value = workouts.value.filter((w) => w.id !== id)
  }

  /** Mitattu voittaa kirjatun: Stravan kesto korvaa oman ajastuksen. */
  async function confirmMatch(id: string) {
    const workout = workouts.value.find((w) => w.id === id)
    if (!workout?.pendingMatch) return
    const { stravaActivityId, startedAt, durationSec } = workout.pendingMatch
    await save({
      ...workout,
      measured: { stravaActivityId, startedAt, durationSec },
      pendingMatch: undefined,
    })
  }

  /** Hylätystä aktiviteetista tulee oma merkintänsä kun Strava-tuonti on pystyssä. */
  async function rejectMatch(id: string) {
    const workout = workouts.value.find((w) => w.id === id)
    if (!workout) return
    await save({ ...workout, pendingMatch: undefined })
  }

  return { workouts, load, save, applyRemote, removeLocal, confirmMatch, rejectMatch }
})
