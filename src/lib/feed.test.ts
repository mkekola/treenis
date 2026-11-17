import { describe, expect, it } from 'vitest'
import {
  commentTime,
  feedLines,
  groupByDay,
  myReaction,
  nextReaction,
  reactionLabel,
  reactionNames,
  summarizeReactions,
  type FeedRow,
} from './feed'

const me = 'me'
const reactions: FeedRow['reactions'] = [
  { reaction: 'fire', userId: 'anna', name: 'Anna' },
  { reaction: 'clap', userId: me, name: 'Maria' },
  { reaction: 'fire', userId: 'mikko', name: 'Mikko' },
  { reaction: 'fire', userId: 'outsider', name: null },
]

describe('reaktiot', () => {
  it('kokoaa annetut reaktiot valikon järjestyksessä', () => {
    const summary = summarizeReactions(reactions, me)
    expect(summary.map((s) => [s.key, s.count, s.mine])).toEqual([
      ['clap', 1, true],
      ['fire', 3, false],
    ])
  })

  it('näyttää tutut nimeltä, oman "Sinä" ja vieraat lukumääränä', () => {
    const [clap, fire] = summarizeReactions(reactions, me)
    expect(reactionLabel(clap)).toBe('Taputus: Sinä')
    expect(reactionLabel(fire)).toBe('Tulessa: Anna, Mikko ja 1 muu')
    expect(reactionNames(fire)).toBe('Anna, Mikko ja 1 muu')
  })

  it('oma reaktio on "Sinä", vaikka nimeä ei olisi asetettu', () => {
    const [fire] = summarizeReactions([{ reaction: 'fire', userId: me, name: null }], me)
    expect(reactionLabel(fire)).toBe('Tulessa: Sinä')
  })

  it('löytää oman reaktion', () => {
    expect(myReaction(reactions, me)).toBe('clap')
    expect(myReaction([], me)).toBeNull()
  })

  it('uusi reaktio korvaa vanhan, sama napautus poistaa', () => {
    expect(nextReaction(null, 'fire')).toBe('fire')
    expect(nextReaction('clap', 'fire')).toBe('fire')
    expect(nextReaction('fire', 'fire')).toBeNull()
  })
})

const row = (overrides: Partial<FeedRow>): FeedRow => ({
  workout_id: 'w',
  user_id: 'beni',
  name: 'Beni',
  is_me: false,
  sport: 'run',
  date: '2026-11-13',
  started_at: null,
  from_strava: false,
  duration_sec: 35 * 60,
  distance_m: 5000,
  exercises: null,
  records: null,
  reactions: [],
  ...overrides,
})

describe('syötteen rivit', () => {
  it('ryhmittelee päivittäin: tänään, eilen ja viikonpäivä', () => {
    const now = new Date(2026, 10, 15, 12)
    const days = groupByDay(
      [row({ workout_id: 'a', date: '2026-11-15' }), row({ workout_id: 'b', date: '2026-11-14' }),
        row({ workout_id: 'c', date: '2026-11-13' }), row({ workout_id: 'd', date: '2026-11-13' })],
      now,
    )
    expect(days.map((d) => [d.label, d.rows.length])).toEqual([['Tänään', 1], ['Eilen', 1], ['Perjantai 13.11.', 2]])
  })

  it('nimi ja laji, treenin omaa nimeä ei näytetä', () => {
    // Luvun ja yksikön välissä on kapea sitova välilyönti; vertailu tavallisella.
    const lines = (overrides: Partial<FeedRow>) => {
      const { who, what, detail } = feedLines(row(overrides))
      return { who, what, detail: detail.replaceAll('\u202F', ' ') }
    }
    expect(lines({})).toEqual({ who: 'Beni', what: 'Juoksu', detail: '35 min · 5,00 km' })
    expect(lines({ is_me: true, sport: 'strength', distance_m: null, duration_sec: 3900 }))
      .toEqual({ who: 'Sinä', what: 'Sali', detail: '1 t 5 min' })
    expect(lines({ from_strava: true })).toEqual({ who: 'Beni', what: 'Juoksu', detail: '35 min · 5,00 km · Strava' })
  })
})

describe('kommentit', () => {
  const now = new Date(2026, 10, 17, 18, 0)

  it('tämän päivän kommentista vain kellonaika', () => {
    expect(commentTime(new Date(2026, 10, 17, 9, 5).toISOString(), now)).toBe('09.05')
  })

  it('aiemmasta kommentista päivä ja kellonaika', () => {
    expect(commentTime(new Date(2026, 10, 15, 17, 28).toISOString(), now)).toBe('15.11. klo 17.28')
  })
})
