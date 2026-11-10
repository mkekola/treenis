import { describe, expect, it } from 'vitest'
import { recentExerciseIds, sessionsFor } from '@/lib/history'
import { doneSets, entry, strengthWorkout } from '@/test/fixtures'

const history = [
  strengthWorkout('old', '2026-11-02', [
    entry('dumbbell-bench-press', doneSets(20, [12, 12, 12]), 'right'),
    entry('plank', [{ durationSec: 60, done: true }]),
  ]),
  strengthWorkout('new', '2026-11-09', [
    entry('dumbbell-bench-press', doneSets(22, [12, 12, 12]), 'easy'),
    entry('lat-pulldown', doneSets(45, [15, 15, 15])),
    entry('back-squat', [{ weightKg: 80, reps: 10, done: false }]),
  ]),
]

describe('sessionsFor', () => {
  it('palauttaa uusimman ensin, enintään kaksi', () => {
    const sessions = sessionsFor('dumbbell-bench-press', history)
    expect(sessions.map((s) => s.sets[0].weightKg)).toEqual([22, 20])
    expect(sessions[0].feel).toBe('easy')
  })

  it('ohittaa kerrat joissa yhtään sarjaa ei tehty', () => {
    expect(sessionsFor('back-squat', history)).toEqual([])
  })

  it('palauttaa tyhjän tuntemattomalle liikkeelle', () => {
    expect(sessionsFor('olematon', history)).toEqual([])
  })
})

describe('recentExerciseIds', () => {
  it('listaa viimeksi tehdyt uusimmasta alkaen, kukin kerran', () => {
    expect(recentExerciseIds(history)).toEqual(['dumbbell-bench-press', 'lat-pulldown', 'plank'])
  })

  it('noudattaa rajausta', () => {
    expect(recentExerciseIds(history, 2)).toHaveLength(2)
  })
})
