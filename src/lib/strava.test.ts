import { describe, expect, it } from 'vitest'
import {
  measuredFrom,
  reconcile,
  resolveActivity,
  stravaWorkoutId,
  sportFromStrava,
  workoutFromActivity,
  type StravaActivity,
} from '@/lib/strava'
import type { Workout } from '@/types/workout'

function activity(overrides: Partial<StravaActivity> = {}): StravaActivity {
  return {
    id: 101,
    sportType: 'WeightTraining',
    name: 'Iltapäivän salitreeni',
    startedAt: '2026-11-12T15:02:00Z',
    elapsedSec: 3600,
    ...overrides,
  }
}

/** Treeniksessä kirjattu salitreeni, joka alkoi annettuna hetkenä. */
function logged(id: string, startedAt: string, durationSec = 3500, overrides: Partial<Workout> = {}): Workout {
  return {
    id,
    sport: 'strength',
    date: startedAt.slice(0, 10),
    title: 'Treeni 1',
    logged: { startedAt, durationSec, blocks: [] },
    ...overrides,
  }
}

describe('lajit', () => {
  it('tuntee yleisimmät Stravan lajit', () => {
    expect(sportFromStrava('Run')).toBe('run')
    expect(sportFromStrava('TrailRun')).toBe('run')
    expect(sportFromStrava('WeightTraining')).toBe('strength')
    expect(sportFromStrava('NordicSki')).toBe('nordic')
    expect(sportFromStrava('Kitesurf')).toBe('kitesurf')
    expect(sportFromStrava('Walk')).toBe('walk')
  })

  it('tuntemattomat menevät lajiin Muu', () => {
    expect(sportFromStrava('Pickleball')).toBe('other')
  })
})

describe('mitattu data', () => {
  it('juoksun kesto on liikkeelläoloaika, jotta vauhti vastaa Stravaa', () => {
    const run = activity({ sportType: 'Run', elapsedSec: 2000, movingSec: 1900, distanceM: 5000, avgHr: 152 })
    expect(measuredFrom(run)).toEqual({
      stravaActivityId: 101,
      startedAt: '2026-11-12T15:02:00Z',
      durationSec: 1900,
      distanceM: 5000,
      avgHr: 152,
    })
  })

  it('salitreenin kesto on koko aika, lepo mukaan lukien', () => {
    expect(measuredFrom(activity({ elapsedSec: 3600, movingSec: 1200 })).durationSec).toBe(3600)
  })

  it('pelkästä aktiviteetista syntyy treeni kiinteällä tunnisteella', () => {
    const workout = workoutFromActivity(activity({ sportType: 'Walk', name: 'Iltakävely' }))
    expect(workout).toMatchObject({ id: '00000000-0000-4000-8000-000000000065', sport: 'walk', title: 'Iltakävely', date: '2026-11-12' })
    expect(workout.logged).toBeUndefined()
  })
})

describe('yhdistäminen', () => {
  it('selvä osuma yhdistyy itsestään', () => {
    const w = logged('w1', '2026-11-12T15:05:00Z')
    expect(resolveActivity(activity(), [w])).toEqual({ kind: 'merge', workoutId: 'w1' })
  })

  it('ilman kirjattua vastinetta syntyy uusi treeni', () => {
    const yesterday = logged('w1', '2026-11-11T15:05:00Z')
    expect(resolveActivity(activity(), [yesterday])).toEqual({ kind: 'new' })
    expect(resolveActivity(activity(), [])).toEqual({ kind: 'new' })
  })

  it('eri laji samaan aikaan kysytään', () => {
    const w = logged('w1', '2026-11-12T15:05:00Z')
    expect(resolveActivity(activity({ sportType: 'Run' }), [w])).toEqual({ kind: 'pending', workoutId: 'w1' })
  })

  it('kaksi ehdokasta kysytään, ja kysymys menee paremmin osuvalle', () => {
    const first = logged('w1', '2026-11-12T14:40:00Z', 1500)
    const second = logged('w2', '2026-11-12T15:10:00Z', 3000)
    expect(resolveActivity(activity(), [first, second])).toEqual({ kind: 'pending', workoutId: 'w2' })
  })

  it('vähän päällekkäin, mutta selvästi eri aikaan alkanut kysytään', () => {
    const w = logged('w1', '2026-11-12T15:45:00Z', 3600)
    expect(resolveActivity(activity(), [w])).toEqual({ kind: 'pending', workoutId: 'w1' })
  })

  it('jo käsiteltyyn aktiviteettiin ei kosketa', () => {
    const merged = logged('w1', '2026-11-12T15:05:00Z', 3500, {
      measured: { stravaActivityId: 101, startedAt: '2026-11-12T15:02:00Z', durationSec: 3600 },
    })
    expect(resolveActivity(activity(), [merged])).toEqual({ kind: 'done' })
    expect(resolveActivity(activity(), [workoutFromActivity(activity())])).toEqual({ kind: 'done' })
  })

  it('treeni jolla on jo mitattu puoli tai avoin kysymys ei ole ehdokas', () => {
    const other = logged('w1', '2026-11-12T15:05:00Z', 3500, {
      pendingMatch: { stravaActivityId: 999, startedAt: '2026-11-12T15:00:00Z', durationSec: 3000, stravaSportName: 'Run' },
    })
    expect(resolveActivity(activity(), [other])).toEqual({ kind: 'new' })
  })
})

describe('sovitus laitteen treeneihin', () => {
  const own = stravaWorkoutId(101)

  it('selvä osuma täydentää kirjatun treenin mitatulla puolella', () => {
    const w = logged('w1', '2026-11-12T15:05:00Z')
    const result = reconcile(activity({ avgHr: 120 }), [w])
    expect(result.remove).toEqual([])
    expect(result.save).toMatchObject([{ id: 'w1', measured: { stravaActivityId: 101, durationSec: 3600, avgHr: 120 } }])
  })

  it('epävarma osuma jää kysymykseksi lajin nimellä', () => {
    const w = logged('w1', '2026-11-12T15:05:00Z')
    expect(reconcile(activity({ sportType: 'Run' }), [w]).save).toMatchObject([
      { id: 'w1', pendingMatch: { stravaActivityId: 101, stravaSportName: 'Juoksu' } },
    ])
  })

  it('ilman vastinetta syntyy oma treeni', () => {
    expect(reconcile(activity(), []).save).toMatchObject([{ id: own, sport: 'strength' }])
  })

  it('toistettu ajo ei muuta mitään', () => {
    const merged = reconcile(activity(), [logged('w1', '2026-11-12T15:05:00Z')]).save
    expect(reconcile(activity(), merged)).toEqual({ save: [], remove: [] })
    const created = reconcile(activity(), []).save
    expect(reconcile(activity(), created)).toEqual({ save: [], remove: [] })
  })

  it('avoimeen kysymykseen ei kosketa', () => {
    const asked = reconcile(activity({ sportType: 'Run' }), [logged('w1', '2026-11-12T15:05:00Z')]).save
    expect(reconcile(activity({ sportType: 'Run' }), asked)).toEqual({ save: [], remove: [] })
  })

  it('Stravassa muokattu aktiviteetti päivittää mitatun puolen', () => {
    const merged = reconcile(activity(), [logged('w1', '2026-11-12T15:05:00Z')]).save
    expect(reconcile(activity({ avgHr: 131 }), merged).save).toMatchObject([{ id: 'w1', measured: { avgHr: 131 } }])
    const created = reconcile(activity(), []).save
    expect(reconcile(activity({ name: 'Salitreeni' }), created).save).toMatchObject([{ id: own, title: 'Salitreeni' }])
  })

  it('kahden laitteen tupla yhdistyy kirjattuun ja poistuu', () => {
    const stravaOnly = workoutFromActivity(activity())
    const synced = logged('w1', '2026-11-12T15:05:00Z')
    const result = reconcile(activity(), [stravaOnly, synced])
    expect(result.remove).toEqual([own])
    expect(result.save).toMatchObject([{ id: 'w1', measured: { stravaActivityId: 101 } }])
  })

  it('"ei sama" -vastauksen jälkeen ei kysytä uudelleen', () => {
    const rejected = workoutFromActivity(activity({ sportType: 'Run' }))
    const w = logged('w1', '2026-11-12T15:05:00Z')
    expect(reconcile(activity({ sportType: 'Run' }), [rejected, w])).toEqual({ save: [], remove: [] })
  })

  it('Stravasta poistettu aktiviteetti poistaa pelkän Strava-treenin, ei kirjattua', () => {
    expect(reconcile(activity(), [workoutFromActivity(activity())], true)).toEqual({ save: [], remove: [own] })
    const merged = reconcile(activity(), [logged('w1', '2026-11-12T15:05:00Z')]).save
    expect(reconcile(activity(), merged, true)).toEqual({ save: [], remove: [] })
  })
})
