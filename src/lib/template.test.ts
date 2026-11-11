import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  addExercise,
  canJoin,
  canMove,
  detach,
  joinWithPrevious,
  move,
  newTemplate,
  removeExercise,
  setRest,
  setTarget,
  targetOf,
} from '@/lib/template'
import { exercise } from '@/test/fixtures'
import type { WorkoutTemplate } from '@/types/workout'

const templateA = initialTemplates[0]
const ids = (t: WorkoutTemplate) => t.blocks.map((b) => b.exercises.map((e) => e.exerciseId))

describe('liikkeen lisäys', () => {
  it('lisää liikkeen loppuun omaksi lohkokseen oletustavoitteella', () => {
    const t = addExercise(newTemplate('t', 'Uusi'), 'b1', exercise('leg-press'))
    expect(t.blocks).toHaveLength(1)
    expect(t.blocks[0].restSec).toBe(90)
    expect(targetOf(t.blocks[0].exercises[0])).toMatchObject({ sets: 3, reps: 10 })
  })

  it('aikaliike saa keston toistojen sijaan', () => {
    const t = addExercise(newTemplate('t', 'Uusi'), 'b1', exercise('plank'))
    expect(targetOf(t.blocks[0].exercises[0])).toMatchObject({ sets: 3, durationSec: 30 })
  })

  it('ei muuta alkuperäistä', () => {
    const before = JSON.stringify(templateA)
    addExercise(templateA, 'x', exercise('leg-press'))
    expect(JSON.stringify(templateA)).toBe(before)
  })
})

describe('tavoitteen muutos', () => {
  const at = { block: 0, exercise: 0 }

  it('muuttaa sarjamäärää ja pitää toistot', () => {
    const t = setTarget(templateA, at, 'weight_reps', { sets: 5 })
    expect(targetOf(t.blocks[0].exercises[0])).toMatchObject({ sets: 5, reps: 10 })
  })

  it('muuttaa kaikkien sarjojen toistot', () => {
    const t = setTarget(templateA, at, 'weight_reps', { value: 8 })
    expect(t.blocks[0].exercises[0].sets.every((s) => s.reps === 8 && !s.done)).toBe(true)
  })

  it('pitää sarjamäärän järkevissä rajoissa', () => {
    expect(targetOf(setTarget(templateA, at, 'weight_reps', { sets: 0 }).blocks[0].exercises[0]).sets).toBe(1)
    expect(targetOf(setTarget(templateA, at, 'weight_reps', { sets: 99 }).blocks[0].exercises[0]).sets).toBe(10)
  })
})

describe('järjestys ja poisto', () => {
  it('siirtää yksittäisen liikkeen lohkona', () => {
    const t = move(templateA, { block: 1, exercise: 0 }, -1)
    expect(ids(t).slice(0, 2)).toEqual([['dumbbell-bench-press'], ['back-squat']])
  })

  it('ei siirrä ensimmäistä ylös eikä viimeistä alas', () => {
    expect(canMove(templateA, { block: 0, exercise: 0 }, -1)).toBe(false)
    expect(canMove(templateA, { block: 5, exercise: 0 }, 1)).toBe(false)
  })

  it('poistaa liikkeen ja tyhjän lohkon', () => {
    const t = removeExercise(templateA, { block: 0, exercise: 0 })
    expect(t.blocks).toHaveLength(5)
    expect(ids(t)[0]).toEqual(['dumbbell-bench-press'])
  })
})

describe('supersarja', () => {
  // Penkki (1) ja pohjenousu (2) supersarjaksi.
  const joined = joinWithPrevious(templateA, 2)

  it('yhdistää lohkon edelliseen ja pitää edellisen levon', () => {
    const rested = joinWithPrevious(setRest(templateA, 1, 60), 2)
    expect(ids(rested)[1]).toEqual(['dumbbell-bench-press', 'calf-raise'])
    expect(rested.blocks[1].restSec).toBe(60)
    expect(rested.blocks).toHaveLength(5)
  })

  it('ensimmäistä lohkoa ei voi yhdistää', () => {
    expect(canJoin(templateA, 0)).toBe(false)
    expect(joinWithPrevious(templateA, 0)).toBe(templateA)
  })

  it('siirto supersarjan sisällä vaihtaa liikkeiden paikkaa', () => {
    expect(ids(move(joined, { block: 1, exercise: 1 }, -1))[1]).toEqual(['calf-raise', 'dumbbell-bench-press'])
  })

  it('siirto supersarjan reunalta siirtää koko supersarjan', () => {
    const t = move(joined, { block: 1, exercise: 0 }, -1)
    expect(ids(t)[0]).toEqual(['dumbbell-bench-press', 'calf-raise'])
    expect(ids(t)[1]).toEqual(['back-squat'])
  })

  it('erottaa liikkeen omaksi lohkokseen heti perään', () => {
    const t = detach(joined, { block: 1, exercise: 0 }, 'new')
    expect(ids(t).slice(1, 3)).toEqual([['calf-raise'], ['dumbbell-bench-press']])
    expect(t.blocks[2].id).toBe('new')
  })

  it('poisto supersarjasta jättää lohkon toisen liikkeen', () => {
    expect(ids(removeExercise(joined, { block: 1, exercise: 0 }))[1]).toEqual(['calf-raise'])
  })
})
