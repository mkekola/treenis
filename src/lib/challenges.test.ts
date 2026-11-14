import { describe, expect, it } from 'vitest'
import {
  challengeState,
  daysLeft,
  joinNames,
  sortChallenges,
  lengthInDays,
  periodLabel,
  presetPeriod,
  scoreLabel,
  standings,
  winners,
  type ChallengeMember,
} from './challenges'

const member = (userId: string, score: number | null, status: ChallengeMember['status'] = 'accepted'): ChallengeMember => ({
  userId,
  name: userId[0].toUpperCase() + userId.slice(1),
  status,
  score,
})

describe('haasteen tila', () => {
  const row = { starts_on: '2026-12-01', ends_on: '2026-12-31' }
  it('tulossa, käynnissä ja päättynyt', () => {
    expect(challengeState(row, '2026-11-30')).toBe('upcoming')
    expect(challengeState(row, '2026-12-01')).toBe('active')
    expect(challengeState(row, '2026-12-31')).toBe('active')
    expect(challengeState(row, '2027-01-01')).toBe('finished')
  })

  it('päiviä jäljellä päättymispäivä mukaan lukien', () => {
    expect(daysLeft('2026-12-31', '2026-12-20')).toBe(12)
    expect(daysLeft('2026-12-31', '2026-12-31')).toBe(1)
    expect(lengthInDays('2026-12-01', '2026-12-31')).toBe(31)
  })
})

describe('järjestys ja voittajat', () => {
  it('järjestää tuloksen mukaan ja jättää kutsutut pois', () => {
    const ranked = standings([member('mikko', 5), member('anna', 11), member('liisa', null, 'invited'), member('sini', 9)])
    expect(ranked.map((s) => [s.name, s.rank])).toEqual([
      ['Anna', 1],
      ['Sini', 2],
      ['Mikko', 3],
    ])
  })

  it('tasatulos jakaa sijan ja voiton', () => {
    const members = [member('anna', 7), member('mikko', 7), member('sini', 3)]
    expect(standings(members).map((s) => s.rank)).toEqual([1, 1, 3])
    expect(winners(members).map((s) => s.name)).toEqual(['Anna', 'Mikko'])
  })

  it('ei voittajaa, jos kukaan ei treenannut', () => {
    expect(winners([member('anna', 0), member('mikko', 0)])).toEqual([])
  })
})

describe('haasteiden järjestys', () => {
  it('kutsut, käynnissä, tulossa, päättyneet', () => {
    const row = (id: string, starts_on: string, ends_on: string, my_status: 'invited' | 'accepted' = 'accepted') => ({
      id,
      metric: 'strength' as const,
      starts_on,
      ends_on,
      creator: 'x',
      my_status,
      previous_score: null,
      members: [],
    })
    const sorted = sortChallenges(
      [
        row('finished', '2026-10-01', '2026-11-10'),
        row('upcoming', '2026-11-20', '2026-11-30'),
        row('active', '2026-11-01', '2026-11-25'),
        row('invite', '2026-11-20', '2026-12-20', 'invited'),
      ],
      '2026-11-14',
    )
    expect(sorted.map((r) => r.id)).toEqual(['invite', 'active', 'upcoming', 'finished'])
  })
})

describe('tekstit ja jaksot', () => {
  it('nimet luetellaan suomeksi', () => {
    expect(joinNames(['Anna'])).toBe('Anna')
    expect(joinNames(['Anna', 'Sinä', 'Liisa'])).toBe('Anna, Sinä ja Liisa')
  })

  it('tuloksen yksikkö taipuu', () => {
    expect(scoreLabel('strength', 1)).toBe('1 salitreeni')
    expect(scoreLabel('strength', 7)).toBe('7 salitreeniä')
    expect(scoreLabel('weeks', 3)).toBe('3 viikkoa')
  })

  it('viikko on seitsemän päivää tästä päivästä', () => {
    expect(presetPeriod('week', new Date(2026, 10, 14))).toEqual({ startsOn: '2026-11-14', endsOn: '2026-11-20' })
    expect(periodLabel('2026-11-14', '2026-11-20')).toBe('14.11.–20.11.')
  })
})
