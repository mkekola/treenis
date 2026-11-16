import { describe, expect, it } from 'vitest'
import { applyDeviations, findDeviations } from '@/lib/deviation'
import { formatSet } from '@/lib/format'
import { sessionsFor } from '@/lib/history'
import { buildSession, completeSet, nextSetLabel, setValues, startWork, stopWork } from '@/lib/session'
import { estimateDurationSec, fromSession, setTarget, setTargetKind, targetOf } from '@/lib/template'
import { formatWorkTime, hasTimeTarget, isTimedSet } from '@/lib/timed'
import { lookup } from '@/test/fixtures'
import type { Block, SetEntry, Workout, WorkoutTemplate } from '@/types/workout'

const minute = (count: number): SetEntry[] => Array.from({ length: count }, () => ({ durationSec: 60, done: false }))

/** Vatsapäivä: rutistukset 3 × 1 min (aikatavoite) ja jalannostot 3 × 12. */
const core: WorkoutTemplate = {
  id: 'core',
  name: 'Vatsat',
  blocks: [
    { id: 'c1', restSec: 60, exercises: [{ exerciseId: 'crunch', sets: minute(3) }] },
    { id: 'c2', restSec: 60, exercises: [{ exerciseId: 'hanging-leg-raise', sets: [{ reps: 12, done: false }] }] },
  ],
}

function workout(id: string, startedAt: string, blocks: Block[]): Workout {
  return { id, sport: 'strength', date: startedAt.slice(0, 10), title: 'Vatsat', templateId: 'core', logged: { startedAt, blocks } }
}

const timedCrunches = (reps: number[]): Block => ({
  id: 'c1',
  restSec: 60,
  exercises: [{ exerciseId: 'crunch', sets: reps.map((r) => ({ durationSec: 60, reps: r, done: true })) }],
})
const plainCrunches: Block = {
  id: 'x',
  restSec: 60,
  exercises: [{ exerciseId: 'crunch', sets: [{ reps: 15, done: true }, { reps: 15, done: true }] }],
}

const NOW = new Date('2026-11-17T17:00:00Z')

describe('aikasarjan tunnistus ja muotoilu', () => {
  it('aikasarjassa on sekä kesto että toistot, lankussa vain kesto', () => {
    expect(isTimedSet({ durationSec: 60, reps: 31, done: true })).toBe(true)
    expect(isTimedSet({ durationSec: 45, done: true })).toBe(false)
    expect(hasTimeTarget(minute(3), 'reps')).toBe(true)
    expect(hasTimeTarget(minute(3), 'time')).toBe(false)
  })

  it('työaika minuutteina ja sekunteina', () => {
    expect(formatWorkTime(45)).toBe('45\u00A0s')
    expect(formatWorkTime(60)).toBe('1\u00A0min')
    expect(formatWorkTime(90)).toBe('1\u00A0min 30\u00A0s')
  })

  it('tehty aikasarja näyttää toistot ja ajan', () => {
    expect(formatSet({ durationSec: 60, reps: 31, done: true }, 'reps')).toBe('31 / 1\u00A0min')
    expect(formatSet({ durationSec: 60, reps: 20, weightKg: 16, done: true }, 'weight_reps')).toBe('16 × 20 / 1\u00A0min')
  })
})

describe('aikasarja treenissä', () => {
  const history = [workout('w1', '2026-11-10T17:00:00Z', [timedCrunches([32, 28, 25]), plainCrunches])]
  const session = buildSession({ id: 's', now: NOW, template: core, history, exercises: lookup })
  const crunch = session.blocks[0].exercises[0]

  it('tavoite on aika, toistot tyhjinä ja viimeksi paras aikasarjan toistomäärä', () => {
    expect(crunch.target).toEqual({ sets: 3, reps: 0, durationSec: 60 })
    expect(crunch.sets.every((set) => set.reps === undefined && set.durationSec === 60)).toBe(true)
    expect(crunch.previous?.reps).toBe(32)
  })

  it('aikasarjat ja tavalliset sarjat ovat historiassa erikseen', () => {
    const plain = workout('w2', '2026-11-12T17:00:00Z', [plainCrunches])
    const all = [...history, plain]
    expect(sessionsFor('crunch', all, 1, true)[0].sets[0].reps).toBe(32)
    expect(sessionsFor('crunch', all, 1)[0].sets[0].reps).toBe(15)
  })

  it('työaika alkaa, päättää levon ja loppuu sarjan merkintään', () => {
    const resting = { ...session, restEndsAt: '2026-11-17T17:01:00Z' }
    const working = startWork(resting, { block: 0, exercise: 0, set: 0 }, NOW)
    expect(working.restEndsAt).toBeUndefined()
    expect(working.work).toEqual({ set: { block: 0, exercise: 0, set: 0 }, endsAt: '2026-11-17T17:01:00.000Z' })
    expect(stopWork(working).work).toBeUndefined()

    const counted = setValues(working, { block: 0, exercise: 0, set: 0 }, { reps: 30 })
    const done = completeSet(counted, { block: 0, exercise: 0, set: 0 }, NOW)
    expect(done.work).toBeUndefined()
    expect(done.blocks[0].exercises[0].sets[0]).toEqual({ durationSec: 60, reps: 30, done: true })
  })

  it('sarjaa ei voi merkitä ennen toistoja', () => {
    expect(completeSet(session, { block: 0, exercise: 0, set: 0 }, NOW)).toBe(session)
  })

  it('levon ilmoitus kertoo seuraavan aikasarjan ajan', () => {
    expect(nextSetLabel(session, (id) => (id === 'crunch' ? 'Vatsarutistus' : id))).toBe('Vatsarutistus 1\u00A0min')
  })

  it('pohjaksi tallennettaessa aikatavoite säilyy', () => {
    const template = fromSession(session, 't', 'T')
    expect(template.blocks[0].exercises[0].sets).toEqual(minute(3))
  })
})

describe('aikatavoite pohjassa', () => {
  const at = { block: 1, exercise: 0 }

  it('toistotavoite vaihtuu ajaksi ja takaisin, sarjamäärä säilyy', () => {
    const timed = setTargetKind(core, at, 'reps', 'time')
    expect(timed.blocks[1].exercises[0].sets).toEqual(minute(1))
    const back = setTargetKind(timed, at, 'reps', 'reps')
    expect(back.blocks[1].exercises[0].sets).toEqual([{ reps: 10, done: false }])
    expect(setTargetKind(core, at, 'reps', 'reps')).toBe(core)
  })

  it('aikatavoitteen arvo on kesto', () => {
    const longer = setTarget(core, { block: 0, exercise: 0 }, 'reps', { value: 90, sets: 2 })
    expect(targetOf(longer.blocks[0].exercises[0])).toEqual({ sets: 2, reps: undefined, durationSec: 90 })
  })

  it('kestoarvio käyttää työaikaa', () => {
    // 3 × (60 s + 60 s lepo) + 1 × (40 s + 60 s), viimeinen lepo pois = 400 s → lähin 5 min.
    expect(estimateDurationSec(core)).toBe(300)
  })

  it('poikkeaman tavoitesarjat ovat kestoja', () => {
    const blocks = [timedCrunches([30, 28]), { id: 'c2', restSec: 60, exercises: [] }]
    const deviations = findDeviations(core, workout('w', '2026-11-17T17:00:00Z', blocks))
    expect(deviations.find((d) => d.kind === 'sets')).toMatchObject({ exerciseId: 'crunch', from: 3, to: 2 })

    const sitUps: WorkoutTemplate = { ...core, blocks: [{ ...core.blocks[0], exercises: [{ exerciseId: 'sit-up', sets: minute(3) }] }] }
    const swapped = findDeviations(sitUps, workout('w', '2026-11-17T17:00:00Z', [timedCrunches([30, 28, 26])]))
    const updated = applyDeviations(sitUps, swapped, () => 'n')
    expect(updated.blocks[0].exercises[0]).toEqual({ exerciseId: 'crunch', sets: minute(3) })
  })
})
