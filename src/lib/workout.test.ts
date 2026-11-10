import { describe, expect, it } from 'vitest'
import { totalVolumeKg } from '@/lib/workout'
import { doneSets, entry, strengthWorkout } from '@/test/fixtures'

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
