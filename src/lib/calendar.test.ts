import { describe, expect, it } from 'vitest'
import { byMonth, formatToday, newestFirst, thisWeek, weekStart } from '@/lib/calendar'
import type { Workout } from '@/types/workout'

const w = (id: string, date: string, startedAt?: string): Workout => ({
  id,
  sport: 'strength',
  date,
  title: id,
  logged: startedAt ? { startedAt } : undefined,
})

// Tiistai 10.11.2026 iltapäivällä.
const NOW = new Date(2026, 10, 10, 15, 0)

describe('viikko', () => {
  it('alkaa maanantaista', () => {
    expect(weekStart(NOW)).toBe('2026-11-09')
    expect(weekStart(new Date(2026, 10, 15, 23, 59))).toBe('2026-11-09') // sunnuntai
    expect(weekStart(new Date(2026, 10, 16, 0, 1))).toBe('2026-11-16') // maanantai
  })

  it('ottaa vain maanantaista sunnuntaihin', () => {
    const list = [w('su', '2026-11-08'), w('ma', '2026-11-09'), w('su2', '2026-11-15'), w('ma2', '2026-11-16')]
    expect(thisWeek(list, NOW).map((x) => x.id)).toEqual(['ma', 'su2'])
  })

  it('ylittää kuun vaihteen', () => {
    expect(weekStart(new Date(2026, 11, 2))).toBe('2026-11-30')
  })
})

describe('aikajana', () => {
  it('uusin ensin, saman päivän treenit kellonajan mukaan', () => {
    const list = [
      w('aamu', '2026-11-10', '2026-11-10T07:00:00Z'),
      w('eilen', '2026-11-09'),
      w('ilta', '2026-11-10', '2026-11-10T17:00:00Z'),
    ]
    expect(newestFirst(list).map((x) => x.id)).toEqual(['ilta', 'aamu', 'eilen'])
  })

  it('ryhmittelee kuukausittain ja näyttää vuoden vain vanhoille', () => {
    const groups = byMonth([w('a', '2026-10-30'), w('b', '2026-11-02'), w('c', '2025-12-20')], NOW)
    expect(groups.map((g) => g.label)).toEqual(['Marraskuu', 'Lokakuu', 'Joulukuu 2025'])
    expect(groups[0].workouts.map((x) => x.id)).toEqual(['b'])
  })
})

describe('päivän otsikko', () => {
  it('näyttää viikonpäivän ja päivämäärän', () => {
    expect(formatToday(NOW)).toBe('Tiistai 10.11.')
  })
})
