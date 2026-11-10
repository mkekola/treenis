import { describe, expect, it } from 'vitest'
import { bestWeightKg, findRecords } from '@/lib/records'
import { doneSets, entry, strengthWorkout } from '@/test/fixtures'
import type { SessionExercise } from '@/types/session'
import type { SetEntry } from '@/types/workout'

const history = [
  strengthWorkout('a', '2026-11-02', [entry('dumbbell-bench-press', doneSets(20, [12, 12, 12]))]),
  strengthWorkout('b', '2026-11-09', [entry('dumbbell-bench-press', doneSets(22, [12, 12, 12]))]),
]

function benchNow(sets: SetEntry[], measurement: SessionExercise['measurement'] = 'weight_reps'): SessionExercise {
  return { exerciseId: 'dumbbell-bench-press', measurement, target: { sets: 3, reps: 12 }, sets }
}

describe('bestWeightKg', () => {
  it('on suurin paino kaikista aiemmista kerroista', () => {
    expect(bestWeightKg('dumbbell-bench-press', history)).toBe(22)
  })

  it('on null liikkeelle jota ei ole tehty', () => {
    expect(bestWeightKg('plank', history)).toBeNull()
  })
})

describe('findRecords', () => {
  it('löytää ennätyksen kun uusi paino tehtiin tavoitetoistoilla', () => {
    expect(findRecords([benchNow(doneSets(24, [12, 12, 12]))], history)).toEqual([
      { exerciseId: 'dumbbell-bench-press', weightKg: 24, deltaKg: 2 },
    ])
  })

  it('ei laske raskaampaa painoa alle tavoitetoistojen', () => {
    expect(findRecords([benchNow(doneSets(24, [5, 3, 2]))], history)).toEqual([])
  })

  it('ei laske samaa painoa', () => {
    expect(findRecords([benchNow(doneSets(22, [12, 12, 12]))], history)).toEqual([])
  })

  it('ensimmäinen kerta ei ole ennätys', () => {
    const pulldown: SessionExercise = { exerciseId: 'lat-pulldown', measurement: 'weight_reps', target: { sets: 3, reps: 15 }, sets: doneSets(45, [15, 15, 15]) }
    expect(findRecords([pulldown], history)).toEqual([])
  })

  it('ohittaa aikaliikkeet ja tekemättömät sarjat', () => {
    expect(findRecords([benchNow(doneSets(24, [12, 12, 12]), 'time')], history)).toEqual([])
    expect(findRecords([benchNow([{ weightKg: 24, reps: 12, done: false }])], history)).toEqual([])
  })
})
