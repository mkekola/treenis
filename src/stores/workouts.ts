import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, plain } from '@/db'
import { measuredFrom, workoutFromActivity } from '@/lib/strava'
import type { Workout } from '@/types/workout'

export const useWorkouts = defineStore('workouts', () => {
  const workouts = ref<Workout[]>([])
  /** Poistetut treenit. Strava-sovitus tarvitsee ne, jottei poistettu palaa. */
  const removed = ref<Workout[]>([])

  async function load() {
    const all = await db.workouts.toArray()
    workouts.value = all.filter((w) => !w.deletedAt)
    removed.value = all.filter((w) => w.deletedAt)
  }

  function upsertInList(workout: Workout) {
    if (workout.deletedAt) {
      workouts.value = workouts.value.filter((w) => w.id !== workout.id)
      removed.value = [...removed.value.filter((w) => w.id !== workout.id), workout]
      return
    }
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

  /** Poisto on tallennus poistomerkinnällä, jotta se välittyy muille laitteille. */
  async function remove(id: string) {
    const workout = await db.workouts.get(id)
    if (workout) await save({ ...workout, deletedAt: new Date().toISOString() })
  }

  /** Palvelimelta tullut versio. Ei mene jonoon, koska se on jo palvelimella. */
  async function applyRemote(workout: Workout) {
    await db.workouts.put(plain(workout))
    upsertInList(workout)
  }

  /** Mitattu voittaa kirjatun: Stravan kesto ja syke täydentävät oman kirjauksen. */
  async function confirmMatch(id: string) {
    const workout = workouts.value.find((w) => w.id === id)
    if (!workout?.pendingMatch) return
    const { stravaActivityId, startedAt, durationSec } = workout.pendingMatch
    const activity = await db.stravaActivities.get(stravaActivityId)
    await save({
      ...workout,
      measured: activity ? measuredFrom(activity) : { stravaActivityId, startedAt, durationSec },
      pendingMatch: undefined,
    })
  }

  /** "Ei sama": aktiviteetista tulee oma treeninsä, eikä samaa kysytä uudelleen. */
  async function rejectMatch(id: string) {
    const workout = workouts.value.find((w) => w.id === id)
    if (!workout?.pendingMatch) return
    const activity = await db.stravaActivities.get(workout.pendingMatch.stravaActivityId)
    await save({ ...workout, pendingMatch: undefined })
    if (activity) await save(workoutFromActivity(activity))
  }

  return { workouts, removed, load, save, remove, applyRemote, confirmMatch, rejectMatch }
})
