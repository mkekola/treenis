import { describe, expect, it } from 'vitest'
import {
  CARDIO_SPORTS,
  addSegment,
  canMoveSegment,
  goalText,
  isCardio,
  moveSegment,
  newCardioTemplate,
  parsePace,
  planSummary,
  removeSegment,
  segmentText,
  totalsText,
  updateSegment,
} from './cardio'
import type { WorkoutTemplate } from '@/types/workout'

/** Luvun ja yksikön välissä on kapea sitova välilyönti; testit vertaavat tavallisella. */
const plain = (text: string) => text.replaceAll(' ', ' ')

const intervals: WorkoutTemplate = {
  id: 't1',
  name: 'Intervallit',
  blocks: [],
  sport: 'run',
  segments: [
    { id: 's1', name: 'Lämmittely', reps: 1, work: { value: 15, unit: 'min' }, zone: 'pk' },
    { id: 's2', name: 'Vedot', reps: 6, work: { value: 400, unit: 'm' }, recovery: { value: 90, unit: 's' }, zone: 'mk', paceSecPerKm: 270 },
    { id: 's3', name: 'Loppuverryttely', reps: 1, work: { value: 10, unit: 'min' } },
  ],
}

describe('kestävyyspohja', () => {
  it('matkalajit kelpaavat, sali ja tunnin lajit eivät', () => {
    expect(CARDIO_SPORTS).toEqual(expect.arrayContaining(['run', 'walk', 'bike', 'swim', 'nordic']))
    expect(CARDIO_SPORTS).not.toContain('strength')
    expect(CARDIO_SPORTS).not.toContain('yoga')
  })

  it('uusi pohja on kestävyyspohja yhdellä 30 minuutin osiolla', () => {
    const template = newCardioTemplate('t', 'Juoksu', 'run', 's')
    expect(isCardio(template)).toBe(true)
    expect(isCardio({ id: 'x', name: 'Treeni 1', blocks: [] })).toBe(false)
    expect(plain(planSummary(template))).toBe('30 min')
  })

  it('osiot tekstinä: toistot, palautus ja tavoitteet', () => {
    expect(plain(segmentText(intervals.segments![1]))).toBe('6 × 400 m · palautus 90 s')
    expect(plain(goalText(intervals.segments![1]))).toBe('MK · 4.30 /km')
    expect(plain(planSummary(intervals))).toBe('15 min · 6 × 400 m · 10 min')
  })

  it('yhteensä: aika ja matka erikseen, palautuksia yksi vähemmän kuin toistoja', () => {
    // 15 + 10 min ja 5 × 90 s = 32,5 min → 33; vedot 2 400 m.
    expect(plain(totalsText(intervals))).toBe('Yhteensä 33 min + 2,4 km')
    const pk = newCardioTemplate('t', 'PK-lenkki', 'run', 's')
    expect(plain(totalsText(updateSegment(pk, 0, { work: { value: 8, unit: 'km' } })))).toBe('Yhteensä 8 km')
  })

  it('palautus ei näy eikä laske yhdellä toistolla, mutta säilyy talteen', () => {
    const single = updateSegment(intervals, 1, { reps: 1 })
    expect(plain(segmentText(single.segments![1]))).toBe('400 m')
    expect(single.segments![1].recovery).toEqual({ value: 90, unit: 's' })
  })

  it('osioita voi lisätä, siirtää ja poistaa', () => {
    const added = addSegment(intervals, 's4')
    expect(added.segments!.map((s) => s.id)).toEqual(['s1', 's2', 's3', 's4'])
    expect(canMoveSegment(intervals, 0, -1)).toBe(false)
    expect(moveSegment(intervals, 0, 1).segments!.map((s) => s.id)).toEqual(['s2', 's1', 's3'])
    expect(removeSegment(intervals, 1).segments!.map((s) => s.id)).toEqual(['s1', 's3'])
    expect(intervals.segments!.length).toBe(3)
  })

  it('tavoitevauhti tekstistä', () => {
    expect(parsePace('4.30')).toBe(270)
    expect(parsePace('5:05')).toBe(305)
    expect(parsePace('4,3')).toBeUndefined()
    expect(parsePace('')).toBeUndefined()
    expect(parsePace('4.75')).toBeUndefined()
  })
})
