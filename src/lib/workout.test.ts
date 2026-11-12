import { describe, expect, it } from 'vitest'
import { avgHr, distanceM, totalVolumeKg } from '@/lib/workout'
import { doneSets, entry, strengthWorkout } from '@/test/fixtures'
import type { Workout } from '@/types/workout'

describe('totalVolumeKg', () => {
  const workout = strengthWorkout('w', '2026-11-12', [
    entry('single-leg-press', doneSets(40, [10])),
    entry('leg-press', doneSets(40, [10])),
    entry('plank', [{ durationSec: 60, done: true }]),
    entry('bench-press', [{ weightKg: 60, reps: 8, done: false }]),
  ])

  it('tuplaa yhden puolen liikkeen ja ohittaa aikaliikkeet ja tekemättömät sarjat', () => {
    // 40 × 10 × 2 (yhden jalan prässi) + 40 × 10 (kahden jalan prässi)
    expect(totalVolumeKg(workout)).toBe(1200)
  })

  it('käyttää annettua yhden puolen hakua omille liikkeille', () => {
    expect(totalVolumeKg(workout, () => false)).toBe(800)
  })
})

describe('käsin kirjattu matka ja syke', () => {
  const run: Workout = {
    id: 'm1',
    sport: 'run',
    date: '2026-11-12',
    title: 'Iltalenkki',
    logged: { startedAt: '2026-11-12T15:30:00Z', durationSec: 2520, distanceM: 8240, avgHr: 154 },
  }

  it('käytetään, kun mitattua ei ole', () => {
    expect(distanceM(run)).toBe(8240)
    expect(avgHr(run)).toBe(154)
  })

  it('mitattu voittaa kirjatun', () => {
    const merged = { ...run, measured: { stravaActivityId: 1, startedAt: run.logged!.startedAt!, durationSec: 2500, distanceM: 8300, avgHr: 150 } }
    expect(distanceM(merged)).toBe(8300)
    expect(avgHr(merged)).toBe(150)
  })
})
