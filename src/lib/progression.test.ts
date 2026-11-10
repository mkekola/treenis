import { describe, expect, it } from 'vitest'
import { suggestNext, type ExerciseSession, type Target } from '@/lib/progression'
import { doneSets, exercise } from '@/test/fixtures'
import type { Feel } from '@/types/workout'

// Penkki käsipainoilla: askel 2 kg, tavoite 3 × 12.
const bench = exercise('dumbbell-bench-press')
const target: Target = { sets: 3, reps: 12 }

const session = (kg: number, reps: number[], feel?: Feel): ExerciseSession => ({
  sets: doneSets(kg, reps),
  feel,
})

describe('suggestNext', () => {
  describe('nosto', () => {
    it('nostaa kun kaikki sarjat menivät tavoitteeseen ja tuntui kevyeltä', () => {
      expect(suggestNext(bench, target, [session(22, [12, 12, 12], 'easy')])).toEqual({
        kind: 'increase',
        fromKg: 22,
        toKg: 24,
      })
    })

    it('nostaa ylimääräisistä toistoista ilman vastaustakin', () => {
      expect(suggestNext(bench, target, [session(22, [15, 14, 12])])?.kind).toBe('increase')
    })

    it('nostaa ylimääräisistä toistoista vaikka tuntuma oli sopiva', () => {
      expect(suggestNext(bench, target, [session(22, [15, 14, 12], 'right')])?.kind).toBe('increase')
    })
  })

  describe('pito', () => {
    it('pitää kun tuntui sopivalta ja toistot tasan tavoitteessa', () => {
      expect(suggestNext(bench, target, [session(22, [12, 12, 12], 'right')])).toEqual({ kind: 'keep', kg: 22 })
    })

    it('ei nosta pelkän puuttuvan vastauksen perusteella', () => {
      expect(suggestNext(bench, target, [session(22, [12, 12, 12])])?.kind).toBe('keep')
    })

    it('oma arvio voittaa: raskas estää noston ylimääräisistä toistoista huolimatta', () => {
      expect(suggestNext(bench, target, [session(22, [15, 14, 12], 'hard')])?.kind).toBe('keep')
    })

    it('ei nosta kun ylimääräisiä toistoja on liian vähän', () => {
      expect(suggestNext(bench, target, [session(22, [13, 12, 12])])?.kind).toBe('keep')
    })

    it('luottaa toistoihin kun ne ovat ristiriidassa kevyen tuntuman kanssa', () => {
      expect(suggestNext(bench, target, [session(22, [12, 11, 10], 'easy')])?.kind).toBe('keep')
    })

    it('ei nosta kun yksi sarja jäi vajaaksi, vaikka muut menivät yli', () => {
      expect(suggestNext(bench, target, [session(22, [16, 15, 10])])?.kind).toBe('keep')
    })

    it('ei laske yhden huonon kerran takia', () => {
      expect(suggestNext(bench, target, [session(22, [12, 10, 8], 'hard')])?.kind).toBe('keep')
    })
  })

  describe('lasku', () => {
    it('laskee kun toistot jäivät vajaiksi raskaana kahdesti peräkkäin', () => {
      const history = [session(22, [11, 9, 8], 'max'), session(22, [12, 10, 9], 'hard')]
      expect(suggestNext(bench, target, history)).toEqual({ kind: 'decrease', fromKg: 22, toKg: 20 })
    })
  })

  describe('ei ehdotusta', () => {
    it('aikaliikkeelle', () => {
      const plank = exercise('plank')
      expect(suggestNext(plank, target, [{ sets: [{ durationSec: 60, done: true }], feel: 'easy' }])).toBeNull()
    })

    it('ilman historiaa', () => {
      expect(suggestNext(bench, target, [])).toBeNull()
    })
  })

  it('käyttää välineen nousuaskelta: laite 5 kg, tanko oletuksena 2,5 kg', () => {
    const machine = exercise('lat-pulldown')
    const barbell = exercise('back-squat')
    expect(suggestNext(machine, { sets: 3, reps: 15 }, [session(45, [15, 15, 15], 'easy')])).toMatchObject({ toKg: 50 })
    expect(suggestNext(barbell, { sets: 3, reps: 10 }, [session(80, [10, 10, 10], 'easy')])).toMatchObject({ toKg: 82.5 })
  })
})
