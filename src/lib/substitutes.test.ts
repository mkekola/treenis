import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary'
import { musclesOf, similarity, substitutesFor } from '@/lib/substitutes'
import { exercise } from '@/test/fixtures'
import type { Exercise } from '@/types/workout'

const names = (list: Exercise[]) => list.map((e) => e.name)

describe('lihasten samankaltaisuus', () => {
  it('yhteisten lihasten osuus kaikista', () => {
    expect(similarity(['quads', 'glutes'], ['quads', 'glutes'])).toBe(1)
    expect(similarity(['quads', 'glutes'], ['quads'])).toBe(0.5)
    expect(similarity(['quads', 'glutes'], ['calves'])).toBe(0)
    expect(similarity([], [])).toBe(0)
  })

  it('jokaisella kirjaston liikkeellä on päälihakset, paitsi koko kehon burpeella', () => {
    const without = EXERCISE_LIBRARY.filter((e) => !e.muscles?.length).map((e) => e.id)
    expect(without).toEqual(['burpee'])
  })

  it('oma liike ilman lihasvalintaa saa lihakset lihasryhmästä', () => {
    const own: Exercise = { ...exercise('leg-press'), id: 'custom-1', custom: true, muscles: undefined }
    expect(musclesOf(own)).toEqual(['quads', 'glutes'])
  })
})

describe('korvaavat liikkeet', () => {
  it('kyykylle ensin molemmilla jaloilla tehtävät kyykyt ja prässi, ei pohjenousua', () => {
    const found = substitutesFor(exercise('back-squat'), EXERCISE_LIBRARY)
    expect(names(found)).toEqual(['Etukyykky', 'Goblet-kyykky', 'Hack-kyykky', 'Jalkaprässi'])
  })

  it('tasapisteissä eniten tehdyt ensin', () => {
    const found = substitutesFor(exercise('back-squat'), EXERCISE_LIBRARY, ['leg-press', 'hack-squat'])
    expect(names(found).slice(0, 2)).toEqual(['Jalkaprässi', 'Hack-kyykky'])
  })

  it('käsin valittu korvaaja tulee ensin, vaikka lihasvertailu ei löytäisi sitä', () => {
    const found = substitutesFor(exercise('hip-adductor'), EXERCISE_LIBRARY)
    expect(names(found)[0]).toBe('Sumokyykky')
  })

  it('hauiskäännölle ei leuanvetoa: liian vähän yhteisiä lihaksia', () => {
    expect(names(substitutesFor(exercise('barbell-curl'), EXERCISE_LIBRARY))).not.toContain('Leuanveto')
  })

  it('koko kehon liikkeelle ei korvaajia', () => {
    expect(substitutesFor(exercise('burpee'), EXERCISE_LIBRARY)).toEqual([])
  })
})
