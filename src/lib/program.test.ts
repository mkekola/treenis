import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  activate,
  activeProgram,
  addTemplate,
  inRotation,
  removeTemplate,
  templatesOf,
  unassigned,
} from '@/lib/program'
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
