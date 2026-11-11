import { describe, expect, it } from 'vitest'
import { durationParts, formatDurationShort } from '@/lib/format'

const NNBSP = ' '

describe('lyhyt kesto', () => {
  it('alle tunnin pelkät minuutit', () => {
    expect(formatDurationShort(58 * 60)).toBe(`58${NNBSP}min`)
  })

  it('tunnit ja minuutit', () => {
    expect(formatDurationShort(79 * 60)).toBe(`1${NNBSP}t 19${NNBSP}min`)
  })

  it('tasatunnista jää minuutit pois', () => {
    expect(formatDurationShort(3600)).toBe(`1${NNBSP}t`)
    expect(durationParts(2 * 3600 + 20)).toEqual([{ value: 2, unit: 't' }])
  })

  it('luku ja yksikkö eivät rivity erilleen', () => {
    expect(formatDurationShort(79 * 60)).not.toMatch(/\d[  ]/)
  })
})
