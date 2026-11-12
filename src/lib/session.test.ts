import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  addBlock,
  addSet,
  buildSession,
  canComplete,
  canRemoveSet,
  canSwap,
  completeSet,
  isExerciseDone,
  newSessionExercise,
  progress,
  removeExercise,
  removeLastSet,
  setFeel,
  setNotes,
  setValues,
  swapExercise,
  toWorkout,
} from '@/lib/session'
import { doneSets, entry, exercise, lookup, strengthWorkout } from '@/test/fixtures'
import type { ActiveSession, SessionBlock, SetRef } from '@/types/session'

const NOW = new Date('2026-11-12T17:28:00+02:00')
const templateA = initialTemplates[0]

// Historia: penkki tuntui kevyeltä, ylätalja sopivalta, kyykystä ei tietoa.
const history = [
  strengthWorkout(
    'h1',
    '2026-11-09',
    [
      entry('dumbbell-bench-press', doneSets(22, [12, 12, 12]), 'easy'),
      entry('lat-pulldown', doneSets(45, [15, 15, 15]), 'right'),
    ],
    '2026-11-09T17:00:00+02:00',
  ),
]

const at = (block: number, set: number, exerciseIndex = 0): SetRef => ({ block, exercise: exerciseIndex, set })

function startA(): ActiveSession {
  return buildSession({ id: 'w-test', now: NOW, template: templateA, history, exercises: lookup })
}

const first = (s: ActiveSession, block: number) => s.blocks[block].exercises[0]

describe('buildSession', () => {
  const s = startA()

  it('rakentaa kaikki pohjan lohkot, sarjat tekemättä', () => {
    expect(s.blocks).toHaveLength(6)
    expect(s.blocks.every((b) => b.exercises.every((e) => e.sets.every((x) => !x.done)))).toBe(true)
  })

  it('täyttää ehdotetun painon kun edellinen kerta oli kevyt', () => {
    expect(first(s, 1).sets[0].weightKg).toBe(24)
    expect(first(s, 1).hint).toEqual({ kind: 'increase', fromKg: 22, toKg: 24 })
    expect(first(s, 1).previous).toEqual({ weightKg: 22, feel: 'easy' })
  })

  it('pitää painon ilman merkintää kun edellinen kerta oli sopiva', () => {
    expect(first(s, 3).sets[0].weightKg).toBe(45)
    expect(first(s, 3).hint).toBeUndefined()
  })

  it('jättää painon tyhjäksi liikkeelle jolla ei ole historiaa', () => {
    expect(first(s, 0).sets[0].weightKg).toBeUndefined()
    expect(first(s, 0).previous).toBeUndefined()
  })

  it('kopioi tavoitteen pohjasta', () => {
    expect(first(s, 0).target).toEqual({ sets: 3, reps: 10 })
  })

  it('aloittaa tyhjänä ilman pohjaa', () => {
    const blank = buildSession({ id: 'b', now: NOW, history, exercises: lookup })
    expect(blank.blocks).toHaveLength(0)
    expect(blank.title).toBe('Salitreeni')
  })
})

describe('sarjojen kirjaus', () => {
  it('ei merkitse sarjaa tehdyksi ilman painoa', () => {
    const s = startA()
    expect(completeSet(s, at(0, 0), NOW)).toBe(s)
  })

  it('kopioi kirjatun painon liikkeen seuraaviin sarjoihin', () => {
    const s = setValues(startA(), at(0, 0), { weightKg: 60 })
    expect(first(s, 0).sets.every((x) => x.weightKg === 60)).toBe(true)
    expect(canComplete(first(s, 0).sets[0], 'weight_reps')).toBe(true)
  })

  it('ei muuta tehtyä sarjaa kun myöhemmän painoa muutetaan', () => {
    let s = setValues(startA(), at(0, 0), { weightKg: 60 })
    s = completeSet(s, at(0, 0), NOW)
    s = setValues(s, at(0, 1), { weightKg: 62.5 })
    expect(first(s, 0).sets.map((x) => x.weightKg)).toEqual([60, 62.5, 62.5])
  })

  it('aloittaa levon heti yhden liikkeen lohkossa', () => {
    let s = setValues(startA(), at(0, 0), { weightKg: 60 })
    s = completeSet(s, at(0, 0), NOW)
    expect(s.restEndsAt).toBe(new Date(NOW.getTime() + 90_000).toISOString())
  })

  it('ei muuta alkuperäistä sessiota', () => {
    const s = setValues(startA(), at(0, 0), { weightKg: 60 })
    const before = JSON.stringify(s)
    completeSet(s, at(0, 1), NOW)
    expect(JSON.stringify(s)).toBe(before)
  })
})

describe('supersarjan lepo', () => {
  const superset: SessionBlock = {
    id: 'b',
    restSec: 90,
    exercises: [
      { exerciseId: 'bench-press', measurement: 'weight_reps', target: { sets: 2, reps: 8 }, sets: [{ weightKg: 60, reps: 8, done: false }, { weightKg: 60, reps: 8, done: false }] },
      { exerciseId: 'seated-cable-row', measurement: 'weight_reps', target: { sets: 2, reps: 10 }, sets: [{ weightKg: 50, reps: 10, done: false }, { weightKg: 50, reps: 10, done: false }] },
    ],
  }
  const base = { ...buildSession({ id: 'ss', now: NOW, history: [], exercises: lookup }), blocks: [superset] }

  it('alkaa vasta kun kierroksen kaikki liikkeet on tehty', () => {
    let s = completeSet(base, at(0, 0, 0), NOW)
    expect(s.restEndsAt).toBeUndefined()
    s = completeSet(s, at(0, 0, 1), NOW)
    expect(s.restEndsAt).toBeDefined()
    s = completeSet(s, at(0, 1, 0), NOW)
    expect(s.restEndsAt).toBeUndefined()
  })
})

describe('lisää ja poista sarja', () => {
  it('poisto peruu lisäyksen', () => {
    const s = startA()
    expect(first(removeLastSet(addSet(s, 0, 0), 0, 0), 0).sets).toHaveLength(3)
  })

  it('lisäys kopioi viimeisen sarjan arvot tekemättömänä', () => {
    const s = addSet(setValues(startA(), at(0, 0), { weightKg: 60 }), 0, 0)
    expect(first(s, 0).sets[3]).toMatchObject({ weightKg: 60, done: false })
  })

  it('ei koskaan poista tehtyä sarjaa', () => {
    let s = completeSet(setValues(startA(), at(0, 0), { weightKg: 60 }), at(0, 0), NOW)
    s = removeLastSet(removeLastSet(s, 0, 0), 0, 0)
    expect(first(s, 0).sets).toHaveLength(1)
    expect(canRemoveSet(s, 0, 0)).toBe(false)
    expect(removeLastSet(s, 0, 0)).toBe(s)
  })
})

describe('tuntuma', () => {
  function benchDone(): ActiveSession {
    let s = startA()
    for (let i = 0; i < 3; i++) s = completeSet(s, at(1, i), NOW)
    return s
  }

  it('liike on tehty kun kaikki sarjat on merkitty', () => {
    expect(isExerciseDone(first(benchDone(), 1))).toBe(true)
  })

  it('tallentaa vastauksen tai ohituksen', () => {
    expect(first(setFeel(benchDone(), 1, 0, 'easy'), 1).feel).toBe('easy')
    const skipped = setFeel(benchDone(), 1, 0, 'skip')
    expect(first(skipped, 1).feelSkipped).toBe(true)
    expect(first(skipped, 1).feel).toBeUndefined()
  })
})

describe('liikkeen vaihto ja lisäys', () => {
  const pressHistory = [
    strengthWorkout('p1', '2026-11-09', [entry('leg-press', doneSets(100, [12, 12, 12]), 'easy')]),
  ]

  it('uusi liike saa oman historiansa painon ja ehdotuksen, ei vaihdetun painoa', () => {
    const squat = first(startA(), 0)
    const press = newSessionExercise({
      exercise: exercise('leg-press'),
      sets: squat.target.sets,
      reps: squat.target.reps,
      history: pressHistory,
      lookup,
    })
    expect(press.sets).toHaveLength(3)
    expect(press.target.reps).toBe(10)
    expect(press.sets[0].weightKg).toBe(105)
    expect(press.previous?.weightKg).toBe(100)
  })

  it('tuntematon liike saa tyhjän painon', () => {
    const fresh = newSessionExercise({ exercise: exercise('hack-squat'), sets: 3, reps: 10, history: pressHistory, lookup })
    expect(fresh.sets[0].weightKg).toBeUndefined()
    expect(fresh.hint).toBeUndefined()
  })

  it('aikaliike saa oletuksena 30 sekuntia', () => {
    const plank = newSessionExercise({ exercise: exercise('plank'), sets: 2, reps: 10, history: [], lookup })
    expect(plank.sets[0]).toEqual({ durationSec: 30, done: false })
  })

  it('vaihtaa vain ennen ensimmäistä tehtyä sarjaa', () => {
    const s = startA()
    const press = newSessionExercise({ exercise: exercise('leg-press'), sets: 3, reps: 10, history: [], lookup })
    expect(canSwap(first(s, 0))).toBe(true)
    expect(first(swapExercise(s, 0, 0, press), 0).exerciseId).toBe('leg-press')

    const started = completeSet(setValues(s, at(0, 0), { weightKg: 60 }), at(0, 0), NOW)
    expect(canSwap(first(started, 0))).toBe(false)
    expect(swapExercise(started, 0, 0, press)).toBe(started)
  })

  it('lisää liikkeen loppuun ja siirtyy siihen', () => {
    const fresh = newSessionExercise({ exercise: exercise('hack-squat'), sets: 3, reps: 10, history: [], lookup })
    const s = addBlock(startA(), 'new', 90, fresh)
    expect(s.blocks).toHaveLength(7)
    expect(s.currentBlock).toBe(6)
  })
})

describe('toWorkout', () => {
  function finished(): ActiveSession {
    let s = setValues(startA(), at(0, 0), { weightKg: 60 })
    s = completeSet(s, at(0, 0), NOW)
    for (let i = 0; i < 3; i++) s = completeSet(s, at(1, i), NOW)
    return setFeel(s, 1, 0, 'easy')
  }

  it('tallentaa vain tehdyt sarjat ja liikkeet', () => {
    const w = toWorkout(finished(), new Date('2026-11-12T18:26:00+02:00'))
    const blocks = w.logged?.blocks ?? []
    expect(blocks).toHaveLength(2)
    expect(blocks[0].exercises[0].sets).toHaveLength(1)
    expect(blocks[1].exercises[0].sets).toHaveLength(3)
    expect(blocks[1].exercises[0].feel).toBe('easy')
  })

  it('laskee keston ja käyttää paikallista päivää', () => {
    const w = toWorkout(finished(), new Date('2026-11-12T18:26:00+02:00'))
    expect(w.logged?.durationSec).toBe(58 * 60)
    expect(w.date).toBe('2026-11-12')
    expect(w.templateId).toBe('template-a')
  })

  it('siistii muistiinpanon ja jättää tyhjän pois', () => {
    expect(toWorkout(setNotes(finished(), '  Lonkat jumissa.  '), NOW).logged?.notes).toBe('Lonkat jumissa.')
    expect(toWorkout(setNotes(finished(), '   '), NOW).logged?.notes).toBeUndefined()
  })

  it('laskee edistymisen', () => {
    // Treeni 1: 3 + 3 + 3 + 3 + 2 + 3 sarjaa (yhden jalan prässi on 2 × 10).
    expect(progress(finished())).toEqual({ done: 4, total: 17 })
  })
})

describe('liikkeen poisto', () => {
  it('poistaa tekemättömän liikkeen ja sen tyhjän lohkon', () => {
    const s = removeExercise(startA(), 2, 0)
    expect(s.blocks).toHaveLength(5)
    expect(s.blocks.map((b) => b.exercises[0].exerciseId)).not.toContain('calf-raise')
  })

  it('ei poista liikettä, josta on tehty sarja', () => {
    const started = completeSet(setValues(startA(), at(0, 0), { weightKg: 60 }), at(0, 0), NOW)
    expect(started.blocks[0].exercises[0].sets[0].done).toBe(true)
    expect(removeExercise(started, 0, 0)).toBe(started)
  })

  it('käsillä oleva lohko pysyy listan sisällä, kun viimeinen poistetaan', () => {
    let s = startA()
    s = { ...s, currentBlock: 5 }
    s = removeExercise(s, 5, 0)
    expect(s.currentBlock).toBe(4)
  })
})

