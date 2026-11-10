import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary'
import { normalize, searchExercises } from '@/lib/exerciseSearch'

const names = (query: string) => searchExercises(query, EXERCISE_LIBRARY).map((e) => e.name)

describe('normalize', () => {
  it('ei välitä isoista kirjaimista eikä ääkkösistä', () => {
    expect(normalize('  Pohjenousu ÄÖ ')).toBe('pohjenousu ao')
  })
})

describe('searchExercises', () => {
  it('nostaa täsmäosuman hakusanaan ensimmäiseksi', () => {
    expect(names('penkki')[0]).toBe('Penkkipunnerrus')
    expect(names('kyykky')[0]).toBe('Jalkakyykky')
    expect(names('rdl')[0]).toBe('Romanialainen maastaveto')
  })

  it('löytää ilman ääkkösiä', () => {
    expect(names('prassi')).toContain('Jalkaprässi')
  })

  it('löytää lihasryhmän nimellä', () => {
    expect(names('olkapää')).toContain('Pystypunnerrus')
  })

  it('löytää Marian sanaston', () => {
    expect(names('taljasoutu')[0]).toBe('Taljasoutu')
    expect(names('ojentajapunnerrus')[0]).toBe('Ojentajapunnerrus taljalla')
  })

  it('palauttaa tyhjän kun mikään ei osu, ja kaiken tyhjällä haulla', () => {
    expect(names('xyz')).toEqual([])
    expect(names('')).toHaveLength(EXERCISE_LIBRARY.length)
  })
})
