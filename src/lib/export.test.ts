import { describe, expect, it } from 'vitest'
import { exportJson, workoutsCsv } from './export'
import { doneSets, entry, strengthWorkout } from '@/test/fixtures'
import type { Workout } from '@/types/workout'

const names = (id: string) => ({ 'back-squat': 'Jalkakyykky' })[id] ?? id

function lines(csv: string) {
  return csv.replace('﻿', '').trim().split('\r\n')
}

describe('CSV-vienti', () => {
  it('salitreenistä rivi per sarja, desimaalipilkku ja puolipiste', () => {
    const gym = strengthWorkout('w1', '2026-11-12', [entry('back-squat', doneSets(52.5, [10, 8]), 'hard')])
    const [header, first, second] = lines(workoutsCsv([gym], names))
    expect(header.split(';')[0]).toBe('Päivä')
    expect(first.split(';').slice(8, 15)).toEqual(['Jalkakyykky', '1', '10', '52,5', '', 'kyllä', 'Raskas'])
    expect(second.split(';')[9]).toBe('2')
  })

  it('kestävyystreeni yhtenä rivinä, mitattu voittaa kirjatun', () => {
    const run: Workout = {
      id: 'r1',
      sport: 'run',
      date: '2026-11-11',
      title: 'Lenkki',
      logged: { durationSec: 1500, notes: 'Kylmä; liukasta "jäätä"' },
      measured: { stravaActivityId: 1, startedAt: '2026-11-11T15:00:00Z', durationSec: 1860, distanceM: 5240, avgHr: 151 },
    }
    const [, row] = lines(workoutsCsv([run], names))
    expect(row).toBe('2026-11-11;Juoksu;Lenkki;Treenis ja Strava;31;5,24;151;;;;;;;;;"Kylmä; liukasta ""jäätä"""')
  })

  it('treenit päivämäärän mukaan vanhimmasta', () => {
    const a = strengthWorkout('a', '2026-11-12', [])
    const b = strengthWorkout('b', '2026-11-01', [])
    const csv = lines(workoutsCsv([a, b], names))
    expect(csv[1].startsWith('2026-11-01')).toBe(true)
  })
})

describe('JSON-vienti', () => {
  it('sisältää kaiken ja muodon version', () => {
    const json = JSON.parse(
      exportJson({ workouts: [strengthWorkout('w1', '2026-11-12', [])], templates: [], programs: [], customExercises: [] }, new Date('2026-11-14T12:00:00Z')),
    )
    expect(json).toMatchObject({ app: 'Treenis', version: 1, exportedAt: '2026-11-14T12:00:00.000Z' })
    expect(json.workouts).toHaveLength(1)
  })
})
