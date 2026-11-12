import { describe, expect, it } from 'vitest'
import { frequentExerciseIds, sessionsFor } from '@/lib/history'
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

describe('frequentExerciseIds', () => {
  const sessions = [
    strengthWorkout('f1', '2026-11-01', [entry('back-squat', doneSets(50, [10])), entry('lat-pulldown', doneSets(40, [10]))]),
    strengthWorkout('f2', '2026-11-05', [entry('back-squat', doneSets(50, [10]))]),
    strengthWorkout('f3', '2026-11-08', [entry('plank', [{ durationSec: 30, done: true }])]),
    strengthWorkout('f4', '2026-06-01', [entry('cable-curl', doneSets(10, [10])), entry('cable-curl', doneSets(10, [10]))]),
    strengthWorkout('f5', '2026-11-09', [entry('triceps-pushdown', [{ reps: 12, done: false }])]),
  ]

  it('järjestää kertojen mukaan, tasatilanteessa tuoreempi ensin', () => {
    expect(frequentExerciseIds(sessions, '2026-08-12')).toEqual(['back-squat', 'plank', 'lat-pulldown'])
  })

  it('jättää aikarajaa vanhemmat ja tekemättömät pois', () => {
    expect(frequentExerciseIds(sessions, '2026-08-12')).not.toContain('cable-curl')
    expect(frequentExerciseIds(sessions, '2026-08-12')).not.toContain('triceps-pushdown')
  })

  it('noudattaa rajausta', () => {
    expect(frequentExerciseIds(sessions, '2026-01-01', 2)).toHaveLength(2)
  })
})
