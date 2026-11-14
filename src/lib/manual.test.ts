import { describe, expect, it } from 'vitest'
import {
  applyEdit,
  copyInput,
  inputFromWorkout,
  isComplete,
  manualWorkout,
  newInput,
  parseDistance,
  startedAtOf,
  suggestedStart,
  timeOf,
} from '@/lib/manual'
import type { Workout } from '@/types/workout'

const NOW = new Date('2026-11-13T19:00:00')

describe('syötteiden tulkinta', () => {
  it('matka pilkulla kilometreinä, uinti metreinä', () => {
    expect(parseDistance('8,24', 'run')).toBe(8240)
    expect(parseDistance('1500', 'swim')).toBe(1500)
    expect(parseDistance('', 'run')).toBeUndefined()
    expect(parseDistance('abc', 'run')).toBeUndefined()
  })

  it('alkamisaika paikallisena aikana, piste tai kaksoispiste käy', () => {
    expect(timeOf(startedAtOf('2026-11-12', '17.30')!)).toBe('17:30')
    expect(timeOf(startedAtOf('2026-11-12', '7:05')!)).toBe('07:05')
    expect(startedAtOf('2026-11-12', '')).toBeUndefined()
  })

  it('tänään ehdotetaan alkamisajaksi nyt miinus kesto, menneelle päivälle ei arvata', () => {
    expect(suggestedStart('2026-11-13', 45 * 60, NOW)).toBe('18:15')
    expect(suggestedStart('2026-11-12', 45 * 60, NOW)).toBe('')
  })

  it('tallennus vaatii keston eikä tulevaa päivää', () => {
    const input = { ...newInput('yoga', NOW), durationSec: 1500 }
    expect(isComplete(input, '2026-11-13')).toBe(true)
    expect(isComplete({ ...input, durationSec: 0 }, '2026-11-13')).toBe(false)
    expect(isComplete({ ...input, date: '2026-11-14' }, '2026-11-13')).toBe(false)
  })

  it('salitreenin kesto on vapaaehtoinen, eikä tyhjää kestoa tallenneta nollana', () => {
    const input = { ...newInput('strength', NOW), durationSec: 0 }
    expect(isComplete(input, '2026-11-13')).toBe(true)
    const imported: Workout = { id: 'w1', sport: 'strength', date: '2026-10-04', title: 'Treeni B', logged: { blocks: [] } }
    expect(applyEdit(imported, { ...input, title: 'Treeni 2', date: '2026-10-04' }).logged).toMatchObject({
      blocks: [],
      durationSec: undefined,
    })
  })
})

describe('käsin kirjattu treeni', () => {
  it('juoksu: matka ja syke tallentuvat kirjatuiksi', () => {
    const input = { ...newInput('run', NOW), title: 'Iltalenkki', startTime: '18:15', durationSec: 2520, distanceM: 8240, avgHr: 154, rpe: 6, notes: ' Tuulista ' }
    expect(manualWorkout('w1', input)).toEqual({
      id: 'w1',
      sport: 'run',
      date: '2026-11-13',
      title: 'Iltalenkki',
      logged: { startedAt: startedAtOf('2026-11-13', '18:15'), durationSec: 2520, distanceM: 8240, avgHr: 154, rpe: 6, notes: 'Tuulista' },
    })
  })

  it('kestolajille ei tallennu matkaa, ja tyhjä nimi on lajin nimi', () => {
    const input = { ...newInput('yoga', NOW), title: ' ', durationSec: 1500, distanceM: 999 }
    const workout = manualWorkout('w2', input)
    expect(workout.title).toBe('Jooga')
    expect(workout.logged?.distanceM).toBeUndefined()
  })
})

describe('muokkaus ja kopiointi', () => {
  const manual: Workout = manualWorkout('w1', { ...newInput('run', NOW), startTime: '18:00', durationSec: 2400, distanceM: 6000, notes: '' })
  const measuredRun: Workout = {
    ...manual,
    measured: { stravaActivityId: 7, startedAt: '2026-11-13T16:00:00Z', durationSec: 2500, distanceM: 6100 },
  }

  it('lomake saa arvot tallennetusta treenistä', () => {
    expect(inputFromWorkout(manual)).toMatchObject({ date: '2026-11-13', startTime: '18:00', durationSec: 2400, distanceM: 6000 })
  })

  it('muokkaus vaihtaa päivän, nimen ja keston', () => {
    const edited = applyEdit(manual, { ...inputFromWorkout(manual), date: '2026-11-12', title: 'Eilinen', durationSec: 3000 })
    expect(edited).toMatchObject({ date: '2026-11-12', title: 'Eilinen', logged: { durationSec: 3000 } })
  })

  it('kellon mittaamaan aikaan ja kestoon ei kosketa', () => {
    const edited = applyEdit(measuredRun, { ...inputFromWorkout(measuredRun), durationSec: 60, notes: 'Hyvä' })
    expect(edited.measured).toEqual(measuredRun.measured)
    expect(edited.logged?.durationSec).toBe(2400)
    expect(edited.logged?.notes).toBe('Hyvä')
  })

  it('salitreenin sarjat säilyvät muokkauksessa', () => {
    const gym: Workout = { id: 'g', sport: 'strength', date: '2026-11-13', title: 'Treeni 1', logged: { startedAt: '2026-11-13T15:00:00Z', durationSec: 3600, blocks: [{ id: 'a1', restSec: 90, exercises: [] }] } }
    const edited = applyEdit(gym, { ...inputFromWorkout(gym), date: '2026-11-12' })
    expect(edited.logged?.blocks).toEqual(gym.logged?.blocks)
    expect(edited.date).toBe('2026-11-12')
  })

  it('kopio on tälle päivälle ilman alkamisaikaa', () => {
    expect(copyInput(manual, new Date('2026-11-20T10:00:00'))).toMatchObject({ date: '2026-11-20', startTime: '', durationSec: 2400, distanceM: 6000 })
  })
})
