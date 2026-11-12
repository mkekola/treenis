import { describe, expect, it } from 'vitest'
import {
  comparisonLabel,
  footBuckets,
  heatLevel,
  liftProgress,
  periodLabel,
  periodOf,
  regularityRows,
  secondsByGroup,
  shiftPeriod,
  sportTotals,
  weekNumber,
  weekStreak,
} from '@/lib/stats'
import { doneSets, lookup, strengthWorkout } from '@/test/fixtures'
import type { SportKey, Workout } from '@/types/workout'

const TODAY = '2026-11-12' // torstai, viikko 46

function measured(date: string, sport: SportKey, minutes: number, meters = 0): Workout {
  return {
    id: `${date}-${sport}-${minutes}`,
    sport,
    date,
    title: sport,
    measured: { stravaActivityId: 1, startedAt: `${date}T15:00:00Z`, durationSec: minutes * 60, distanceM: meters || undefined },
  }
}

describe('jaksot', () => {
  it('viikko alkaa maanantaista', () => {
    expect(periodOf('week', TODAY)).toEqual({ view: 'week', start: '2026-11-09', end: '2026-11-16' })
    expect(periodOf('week', '2026-11-15')).toEqual({ view: 'week', start: '2026-11-09', end: '2026-11-16' })
  })

  it('kuukausi ja vuosi', () => {
    expect(periodOf('month', TODAY)).toEqual({ view: 'month', start: '2026-11-01', end: '2026-12-01' })
    expect(periodOf('year', TODAY)).toEqual({ view: 'year', start: '2026-01-01', end: '2027-01-01' })
  })

  it('siirtyy edelliseen ja seuraavaan, myös vuodenvaihteen yli', () => {
    expect(shiftPeriod(periodOf('month', '2026-01-15'), -1).start).toBe('2025-12-01')
    expect(shiftPeriod(periodOf('week', '2026-12-30'), 1).start).toBe('2027-01-04')
    expect(shiftPeriod(periodOf('year', TODAY), -1).start).toBe('2025-01-01')
  })

  it('nimeää jakson ja vertailun suomeksi', () => {
    expect(periodLabel(periodOf('year', TODAY))).toBe('2026')
    expect(periodLabel(periodOf('month', '2026-05-20'))).toBe('Toukokuu 2026')
    expect(periodLabel(periodOf('week', TODAY))).toBe('Viikko 46 · 9.11.–15.11.')
    expect(comparisonLabel(periodOf('month', '2026-05-20'))).toBe('huhtikuuhun')
    expect(comparisonLabel(periodOf('year', TODAY))).toBe('vuoteen 2025')
  })

  it('ISO-viikkonumero', () => {
    expect(weekNumber('2026-11-12')).toBe(46)
    expect(weekNumber('2026-01-01')).toBe(1)
    expect(weekNumber('2027-01-01')).toBe(53)
  })
})

describe('säännöllisyys', () => {
  it('ruudun tummuus päivän treeniajasta', () => {
    expect([undefined, 600, 2400, 4000, 6000].map(heatLevel)).toEqual([0, 1, 2, 3, 4])
  })

  it('viikkoputki laskee viikot, joilla on vähintään kaksi treeniä', () => {
    const workouts = [
      measured('2026-10-20', 'run', 30), measured('2026-10-22', 'walk', 30),
      measured('2026-10-27', 'run', 30), measured('2026-10-29', 'walk', 30),
      measured('2026-11-03', 'run', 30), measured('2026-11-06', 'walk', 30),
      measured('2026-11-10', 'run', 30),
    ]
    // Tällä viikolla vasta yksi treeni: putki ei katkea kesken viikon.
    expect(weekStreak(workouts, periodOf('month', TODAY), TODAY)).toEqual({ kind: 'current', weeks: 3, thisWeek: 1, goal: 2 })
  })

  it('lepopäivät eivät katkaise putkea, mutta vajaa viikko katkaisee', () => {
    const workouts = [
      measured('2026-10-05', 'run', 30), measured('2026-10-11', 'walk', 30),
      measured('2026-10-14', 'run', 30),
      measured('2026-10-19', 'run', 30), measured('2026-10-25', 'walk', 30),
    ]
    expect(weekStreak(workouts, periodOf('month', '2026-10-01'), TODAY)).toEqual({ kind: 'past', weeks: 1, goal: 2 })
  })
})

describe('tasapaino ja kestävyys', () => {
  const workouts = [
    measured('2026-05-11', 'walk', 60, 6000),
    measured('2026-05-12', 'run', 30, 5000),
    measured('2026-05-20', 'climb', 40),
    measured('2026-05-22', 'swim', 30, 1200),
  ]

  it('aika lajiryhmittäin, suurin ensin', () => {
    expect(secondsByGroup(workouts)).toEqual([
      { group: 'land', seconds: 90 * 60 },
      { group: 'climbing', seconds: 40 * 60 },
      { group: 'water', seconds: 30 * 60 },
    ])
  })

  it('kilometrit jalan viikoittain kuukauden sisällä', () => {
    const buckets = footBuckets(workouts, periodOf('month', '2026-05-15'), TODAY)
    expect(buckets.map((b) => b.label)).toEqual(['vk 18', 'vk 19', 'vk 20', 'vk 21', 'vk 22'])
    expect(buckets.find((b) => b.label === 'vk 20')?.meters).toBe(11000)
  })

  it('vuosi kuukausittain, tulevat kuukaudet merkittyinä', () => {
    const buckets = footBuckets(workouts, periodOf('year', TODAY), TODAY)
    expect(buckets).toHaveLength(12)
    expect(buckets[4].meters).toBe(11000)
    expect(buckets[11].future).toBe(true)
  })

  it('uinti erikseen metreinä', () => {
    expect(sportTotals(workouts, 'swim')).toEqual({ count: 1, meters: 1200 })
  })
})

describe('salikehitys', () => {
  it('raskain sarja kerralta, vanhin ensin, vain kahdesti tehdyt', () => {
    const workouts = [
      strengthWorkout('w2', '2026-11-05', [{ exerciseId: 'back-squat', sets: doneSets(55, [10, 10]) }]),
      strengthWorkout('w1', '2026-11-01', [
        { exerciseId: 'back-squat', sets: doneSets(50, [10, 10]) },
        { exerciseId: 'lat-pulldown', sets: doneSets(40, [12]) },
      ]),
      strengthWorkout('w3', '2026-11-08', [{ exerciseId: 'plank', sets: [{ durationSec: 60, done: true }] }]),
    ]
    expect(liftProgress(workouts, lookup)).toEqual([{ exerciseId: 'back-squat', weights: [50, 55] }])
  })
})

describe('taulukkonäkymä', () => {
  const workouts = [
    measured('2026-05-20', 'walk', 60),
    measured('2026-05-20', 'climb', 40),
    measured('2026-05-11', 'walk', 30),
    measured('2026-06-03', 'walk', 50),
  ]

  it('vuosi kuukausittain: treenit, treenipäivät ja aika', () => {
    expect(regularityRows(workouts, periodOf('year', TODAY))).toEqual([
      { key: '2026-05', label: 'Toukokuu', workouts: 3, days: 2, seconds: 130 * 60 },
      { key: '2026-06', label: 'Kesäkuu', workouts: 1, days: 1, seconds: 50 * 60 },
    ])
  })

  it('kuukausi päivittäin, vain treenipäivät', () => {
    const may = workouts.filter((w) => w.date.startsWith('2026-05'))
    expect(regularityRows(may, periodOf('month', '2026-05-15')).map((r) => [r.label, r.workouts])).toEqual([
      ['11.5.', 1],
      ['20.5.', 2],
    ])
  })
})
