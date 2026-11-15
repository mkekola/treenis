import { describe, expect, it } from 'vitest'
import { effortOf, effortsInRange, paceLabel, sixMonthsBefore, templateHistory } from './endurance'
import type { Workout } from '@/types/workout'

const run = (id: string, date: string, durationSec: number, distanceM?: number, avgHr?: number, templateId?: string): Workout => ({
  id,
  sport: 'run',
  date,
  title: 'PK-lenkki',
  logged: { durationSec, ...(distanceM ? { distanceM } : {}), ...(avgHr ? { avgHr } : {}) },
  ...(templateId ? { templateId } : {}),
})

const NOW = new Date(2026, 10, 16, 12) // ma 16.11.2026

describe('peruskestävyys', () => {
  it('vauhti lasketaan kestosta ja matkasta, Stravan mittaus voittaa', () => {
    expect(effortOf(run('a', '2026-11-12', 3600, 9400))!.paceSecPerKm).toBeCloseTo(383, 0)
    expect(effortOf(run('b', '2026-11-12', 3600))).toBeNull()
    const measured: Workout = {
      ...run('c', '2026-11-12', 3600, 9000, 120),
      measured: { stravaActivityId: 1, startedAt: '2026-11-12T16:00:00Z', durationSec: 3500, distanceM: 9500, avgHr: 131 },
    }
    expect(effortOf(measured)).toMatchObject({ durationSec: 3500, distanceM: 9500, avgHr: 131 })
  })

  it('sykehaarukka rajat mukaan lukien, vain kuusi kuukautta ja vain juoksut', () => {
    const points = effortsInRange(
      [
        run('uusin', '2026-11-12', 3600, 9400, 130),
        run('vanha', '2026-10-01', 3600, 8600, 131),
        run('raja', '2026-10-15', 3600, 8900, 135),
        run('liian-kova', '2026-11-01', 3600, 10000, 150),
        run('ei-sykettä', '2026-11-02', 3600, 9000),
        run('yli-6kk', '2026-05-01', 3600, 8000, 130),
        { ...run('pyora', '2026-11-03', 3600, 25000, 130), sport: 'bike' },
      ],
      'run',
      { min: 125, max: 135 },
      NOW,
    )
    expect(points.map((p) => p.workoutId)).toEqual(['vanha', 'raja', 'uusin'])
    expect(sixMonthsBefore(NOW)).toBe('2026-05-16')
  })

  it('pohjan historia uusin ensin', () => {
    const history = templateHistory(
      [run('a', '2026-10-01', 3600, 8600, 130, 't'), run('b', '2026-11-12', 3600, 9400, 130, 't'), run('c', '2026-11-01', 3600, 9000, 130, 'x')],
      't',
    )
    expect(history.map((w) => w.id)).toEqual(['b', 'a'])
  })

  it('vauhti minuutteina ja sekunteina', () => {
    expect(paceLabel(383)).toBe('6.23')
    expect(paceLabel(419.6)).toBe('7.00')
  })
})
