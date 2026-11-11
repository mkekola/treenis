import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  activate,
  activeProgram,
  addTemplate,
  inRotation,
  programProgress,
  removeTemplate,
  templatesOf,
  unassigned,
} from '@/lib/program'
import { doneSets, entry, strengthWorkout } from '@/test/fixtures'
import type { Program } from '@/types/workout'

const [a, b] = initialTemplates
const program = (id: string, activatedAt?: string, templateIds: string[] = []): Program => ({
  id,
  name: id,
  templateIds,
  activatedAt,
})

describe('aktiivinen ohjelma', () => {
  it('on viimeksi käyttöön otettu', () => {
    const programs = [program('vanha', '2026-08-01T00:00:00Z'), program('uusi', '2026-11-01T00:00:00Z'), program('arkisto')]
    expect(activeProgram(programs)?.id).toBe('uusi')
  })

  it('käyttöönotto tekee ohjelmasta aktiivisen', () => {
    const programs = [program('vanha', '2026-08-01T00:00:00Z'), activate(program('uusi'), new Date('2026-11-10T12:00:00Z'))]
    expect(activeProgram(programs)?.id).toBe('uusi')
  })

  it('puuttuu kun yhtään ei ole otettu käyttöön', () => {
    expect(activeProgram([program('x')])).toBeUndefined()
  })
})

describe('ohjelman treenit', () => {
  it('pitää ohjelman järjestyksen ja ohittaa puuttuvat', () => {
    const p = program('p', undefined, [b.id, 'puuttuu', a.id])
    expect(templatesOf(p, [a, b]).map((t) => t.id)).toEqual([b.id, a.id])
  })

  it('ei lisää samaa treeniä kahdesti ja poistaa', () => {
    const p = addTemplate(addTemplate(program('p'), a.id), a.id)
    expect(p.templateIds).toEqual([a.id])
    expect(removeTemplate(p, a.id).templateIds).toEqual([])
  })

  it('löytää treenit ilman ohjelmaa', () => {
    expect(unassigned([program('p', undefined, [a.id])], [a, b]).map((t) => t.id)).toEqual([b.id])
  })
})

describe('vuorottelu', () => {
  it('ehdottaa tekemätöntä ensin ohjelman järjestyksessä', () => {
    expect(inRotation([a, b]).map((t) => t.id)).toEqual([a.id, b.id])
  })

  it('A:n jälkeen vuorossa on B', () => {
    const doneA = { ...a, lastUsedAt: '2026-11-09T17:00:00Z' }
    const doneB = { ...b, lastUsedAt: '2026-11-06T17:00:00Z' }
    expect(inRotation([doneA, doneB])[0].id).toBe(b.id)
    expect(inRotation([doneA, b])[0].id).toBe(b.id)
  })
})

describe('ohjelman edistyminen', () => {
  const activated = '2026-10-26T10:00:00Z' // maanantai
  const base: Program = { id: 'p', name: 'Koko kroppa', templateIds: [a.id, b.id], activatedAt: activated, durationWeeks: 8 }
  const workout = (id: string, date: string, templateId?: string) => ({
    ...strengthWorkout(id, date, [entry('back-squat', doneSets(60, [10, 10]))], `${date}T17:00:00Z`),
    templateId,
  })
  const workouts = [
    workout('ennen', '2026-10-20', a.id),
    workout('w1', '2026-10-27', a.id),
    workout('w2', '2026-10-30', b.id),
    workout('w3', '2026-11-10', a.id),
    workout('muu', '2026-11-10', 'template-muu'),
  ]

  it('laskee viikon käyttöönotosta ja vain ohjelman omat treenit', () => {
    const p = programProgress(base, workouts, new Date('2026-11-11T12:00:00Z'))
    expect(p).toMatchObject({ week: 3, totalWeeks: 8, done: 3, planned: 16, volumeKg: 3 * 1200 })
  })

  it('ei mene keston yli eikä suunnittele ilman kestoa', () => {
    expect(programProgress(base, [], new Date('2027-03-01T12:00:00Z'))?.week).toBe(8)
    const open = programProgress({ ...base, durationWeeks: undefined }, [], new Date('2026-11-11T12:00:00Z'))
    expect(open).toEqual({ week: 3, done: 0, volumeKg: 0 })
  })

  it('puuttuu, jos ohjelmaa ei ole otettu käyttöön', () => {
    expect(programProgress({ ...base, activatedAt: undefined }, workouts, new Date())).toBeNull()
  })
})
