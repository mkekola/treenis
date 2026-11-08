import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, plain } from '@/db'
import type { Workout } from '@/types/workout'

export const useWorkouts = defineStore('workouts', () => {
  const workouts = ref<Workout[]>([])

  async function load() {
    workouts.value = await db.workouts.toArray()
  }

  /** Tallentaa tietokantaan ja päivittää listan, jotta näkymät seuraavat heti. */
  async function save(workout: Workout) {
    await db.workouts.put(plain(workout))
    const index = workouts.value.findIndex((w) => w.id === workout.id)
    if (index === -1) workouts.value.push(workout)
    else workouts.value[index] = workout
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

  return { workouts, load, save, confirmMatch, rejectMatch }
})
