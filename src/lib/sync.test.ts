import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  exerciseFromRow,
  exerciseToRow,
  latestUpdate,
  programFromRow,
  programToRow,
  pushAll,
  remoteAction,
  stravaActivityFromRow,
  templateFromRow,
  templateToRow,
  toLocal,
  type RemoteWorkout,
} from '@/lib/sync'
import type { Exercise, Program, Workout } from '@/types/workout'

const local = (updatedAt?: string): Workout => ({
  id: 'a',
  sport: 'strength',
  date: '2026-11-10',
  title: 'Treeni 1',
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

describe('ohjelman rivi', () => {
  it('kulkee rivin kautta muuttumattomana', () => {
    const program: Program = {
      id: 'program-default',
      name: 'Koko kroppa 2krt/vko',
      templateIds: ['template-a', 'template-b'],
      color: 'luumu',
      durationWeeks: 8,
      level: 'intermediate',
      activatedAt: '2026-11-10T12:00:00.000Z',
      updatedAt: '2026-11-10T12:00:00.000Z',
    }
    expect(toLocal(programFromRow(programToRow(program)))).toEqual(program)
  })
})

describe('jonon purku', () => {
  const sent: string[] = []
  const done: string[] = []
  const send = async (id: string) => {
    if (id === 'hylatty') throw new Error('palvelin hylkäsi')
    sent.push(id)
    return id !== 'vanhempi'
  }
  const markDone = async (id: string) => void done.push(id)

  it('ohittaa hylätyn rivin ja lähettää muut', async () => {
    sent.length = 0
    done.length = 0
    const result = await pushAll(['a', 'hylatty', 'b'], send, markDone, () => false)
    expect(sent).toEqual(['a', 'b'])
    expect(done).toEqual(['a', 'b'])
    expect(result).toEqual({ serverWasNewer: false, failed: 1 })
  })

  it('kertoo, kun palvelimella oli uudempi versio', async () => {
    const result = await pushAll(['vanhempi'], send, markDone, () => false)
    expect(result.serverWasNewer).toBe(true)
  })

  it('lopettaa heti, kun verkko on poissa', async () => {
    sent.length = 0
    await expect(pushAll(['hylatty', 'a'], send, markDone, () => true)).rejects.toThrow()
    expect(sent).toEqual([])
  })
})

describe('Strava-aktiviteetin rivi', () => {
  it('jättää tyhjät kentät pois', () => {
    expect(
      stravaActivityFromRow({
        id: 101,
        sport_type: 'Run',
        name: 'Iltalenkki',
        started_at: '2026-11-12T15:02:00+00:00',
        elapsed_sec: 2000,
        moving_sec: 1900,
        distance_m: 5012.4,
        avg_hr: 151,
        max_hr: null,
        calories: null,
        elevation_gain_m: null,
        updated_at: '2026-11-12T16:00:00+00:00',
        deleted_at: null,
      }),
    ).toEqual({
      id: 101,
      sportType: 'Run',
      name: 'Iltalenkki',
      startedAt: '2026-11-12T15:02:00+00:00',
      elapsedSec: 2000,
      movingSec: 1900,
      distanceM: 5012.4,
      avgHr: 151,
    })
  })
})
