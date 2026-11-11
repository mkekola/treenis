import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  exerciseFromRow,
  exerciseToRow,
  latestUpdate,
  remoteAction,
  templateFromRow,
  templateToRow,
  toLocal,
  type RemoteWorkout,
} from '@/lib/sync'
import type { Exercise, Workout } from '@/types/workout'

const local = (updatedAt?: string): Workout => ({
  id: 'a',
  sport: 'strength',
  date: '2026-11-10',
  title: 'Treeni A',
  updatedAt,
})

const remote = (updatedAt: string, deletedAt?: string): RemoteWorkout => ({
  ...local(),
  title: 'Treeni A (toinen laite)',
  updatedAt,
  deletedAt,
})

describe('remoteAction', () => {
  it('tallentaa uuden treenin', () => {
    expect(remoteAction(remote('2026-11-10T12:00:00Z'), undefined, false)).toBe('put')
  })

  it('korvaa vanhemman paikallisen version', () => {
    expect(remoteAction(remote('2026-11-10T12:00:00Z'), local('2026-11-10T11:00:00Z'), false)).toBe('put')
  })

  it('ohittaa vanhemman tai saman palvelinversion', () => {
    expect(remoteAction(remote('2026-11-10T11:00:00Z'), local('2026-11-10T12:00:00Z'), false)).toBe('skip')
    expect(remoteAction(remote('2026-11-10T12:00:00Z'), local('2026-11-10T12:00:00.000Z'), false)).toBe('skip')
  })

  it('ei koske jonossa odottavaan omaan muutokseen', () => {
    expect(remoteAction(remote('2026-11-10T13:00:00Z'), local('2026-11-10T11:00:00Z'), true)).toBe('skip')
  })

  it('poistaa laitteelta palvelimella poistetun', () => {
    const deleted = remote('2026-11-10T12:00:00Z', '2026-11-10T12:00:00Z')
    expect(remoteAction(deleted, local('2026-11-10T11:00:00Z'), false)).toBe('delete')
    expect(remoteAction(deleted, undefined, false)).toBe('skip')
  })
})

describe('latestUpdate', () => {
  it('muistaa uusimman muutoksen ja pitää edellisen kun uusia ei tullut', () => {
    const list = [remote('2026-11-10T12:00:00+00:00'), remote('2026-11-10T14:00:00+00:00')]
    expect(latestUpdate(list, '2026-11-09T00:00:00Z')).toBe('2026-11-10T14:00:00+00:00')
    expect(latestUpdate([], '2026-11-09T00:00:00Z')).toBe('2026-11-09T00:00:00Z')
  })
})

describe('toLocal', () => {
  it('jättää palvelimen poistomerkinnän pois', () => {
    expect(toLocal(remote('2026-11-10T12:00:00Z'))).not.toHaveProperty('deletedAt')
  })
})

describe('pohjien ja omien liikkeiden rivit', () => {
  it('pohja kulkee rivin kautta muuttumattomana', () => {
    const template = initialTemplates[0]
    const saved = { ...template, lastUsedAt: '2026-11-09T17:00:00.000Z', updatedAt: '2026-11-10T12:00:00.000Z' }
    const row = templateToRow(saved)
    expect(toLocal(templateFromRow(row))).toEqual(saved)
  })

  it('oma liike kulkee rivin kautta muuttumattomana', () => {
    const exercise: Exercise = {
      id: 'custom-1',
      name: 'Hip thrust laitteessa',
      muscleGroup: 'glutes',
      measurement: 'weight_reps',
      perSide: false,
      aliases: [],
      custom: true,
      weightStepKg: 5,
      updatedAt: '2026-11-10T12:00:00.000Z',
    }
    const row = { ...exerciseToRow(exercise), deleted_at: null }
    expect(toLocal(exerciseFromRow(row))).toEqual(exercise)
  })

  it('välittää poistomerkinnän', () => {
    const row = templateToRow({ ...initialTemplates[1], deletedAt: '2026-11-10T12:00:00Z' })
    expect(templateFromRow(row).deletedAt).toBe('2026-11-10T12:00:00Z')
  })
})
