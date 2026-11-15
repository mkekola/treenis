import { describe, expect, it } from 'vitest'
import { applyDeviations, findDeviations } from '@/lib/deviation'
import { nextOptionIndex, optionsOf } from '@/lib/rotation'
import { buildSession, rotationChoice, swapExercise } from '@/lib/session'
import { addToRotation, removeFromRotation, setTarget, targetOf } from '@/lib/template'
import { doneSets, exercise, lookup } from '@/test/fixtures'
import type { Block, SetEntry, Workout, WorkoutTemplate } from '@/types/workout'

const targets = (count: number, reps: number): SetEntry[] =>
  Array.from({ length: count }, () => ({ reps, done: false }))

/** Jalkapäivä: kyykky → maastaveto → etukyykky kierrossa, sitten prässi. */
const legDay: WorkoutTemplate = {
  id: 'legs',
  name: 'Jalkapäivä',
  blocks: [
    {
      id: 'b1',
      restSec: 120,
      exercises: [
        {
          exerciseId: 'back-squat',
          sets: targets(3, 8),
          alternatives: [
            { exerciseId: 'deadlift', sets: targets(3, 5) },
            { exerciseId: 'front-squat', sets: targets(4, 6) },
          ],
        },
      ],
    },
    { id: 'b2', restSec: 90, exercises: [{ exerciseId: 'leg-press', sets: targets(3, 10) }] },
  ],
}

/** Jalkapäivä tehtynä: ensimmäisessä lohkossa annettu liike, prässi aina. */
function done(id: string, startedAt: string, first: string, sets = 3, templateId = 'legs'): Workout {
  const blocks: Block[] = [
    { id: 'b1', restSec: 120, exercises: [{ exerciseId: first, sets: doneSets(80, Array(sets).fill(5)) }] },
    { id: 'b2', restSec: 90, exercises: [{ exerciseId: 'leg-press', sets: doneSets(100, [10, 10, 10]) }] },
  ]
  return { id, sport: 'strength', date: startedAt.slice(0, 10), title: 'Jalkapäivä', templateId, logged: { startedAt, blocks } }
}

const slot = legDay.blocks[0].exercises[0]
const NOW = new Date('2026-11-16T17:00:00Z')

describe('kierron vuoro', () => {
  it('ensimmäisellä kerralla kierron ensimmäinen', () => {
    expect(nextOptionIndex('legs', 'b1', slot, [])).toBe(0)
  })

  it('seuraava viimeksi tehdyn jälkeen, viimeisen jälkeen alusta', () => {
    expect(nextOptionIndex('legs', 'b1', slot, [done('w1', '2026-11-09T17:00:00Z', 'back-squat')])).toBe(1)
    const history = [
      done('w1', '2026-11-02T17:00:00Z', 'deadlift'),
      done('w2', '2026-11-09T17:00:00Z', 'front-squat'),
    ]
    expect(nextOptionIndex('legs', 'b1', slot, history)).toBe(0)
  })

  it('käsin vaihdettu lasketaan: maastaveto kahdesti putkeen, sitten etukyykky', () => {
    const history = [
      done('w1', '2026-11-02T17:00:00Z', 'back-squat'),
      done('w2', '2026-11-09T17:00:00Z', 'deadlift'),
      done('w3', '2026-11-12T17:00:00Z', 'deadlift'),
    ]
    expect(nextOptionIndex('legs', 'b1', slot, history)).toBe(2)
  })

  it('ohittaa muut pohjat ja kerrat, joilla kiertoa ei tehty', () => {
    const history = [
      done('w1', '2026-11-09T17:00:00Z', 'deadlift'),
      done('w2', '2026-11-12T17:00:00Z', 'leg-press'),
      done('w3', '2026-11-14T17:00:00Z', 'front-squat', 3, 'other'),
    ]
    expect(nextOptionIndex('legs', 'b1', slot, history)).toBe(2)
  })
})

describe('treeni vaihtuvasta liikkeestä', () => {
  const history = [done('w1', '2026-11-09T17:00:00Z', 'back-squat')]
  const session = buildSession({ id: 's', now: NOW, template: legDay, history, exercises: lookup })
  const first = session.blocks[0].exercises[0]

  it('vuorossa oleva liike omilla tavoitteillaan ja koko kierto mukana', () => {
    expect(first.exerciseId).toBe('deadlift')
    expect(first.target).toEqual({ sets: 3, reps: 5 })
    expect(first.rotation?.map((o) => o.exerciseId)).toEqual(['back-squat', 'deadlift', 'front-squat'])
    expect(session.blocks[1].exercises[0].rotation).toBeUndefined()
  })

  it('kierron liikkeeseen vaihto antaa sen omat tavoitteet ja pitää kierron', () => {
    const front = rotationChoice(first, 'front-squat', history, lookup)
    expect(front?.target).toEqual({ sets: 4, reps: 6 })
    const swapped = swapExercise(session, 0, 0, front!)
    expect(swapped.blocks[0].exercises[0].exerciseId).toBe('front-squat')
    expect(swapped.blocks[0].exercises[0].rotation).toHaveLength(3)
    expect(rotationChoice(first, 'leg-press', history, lookup)).toBeNull()
  })

  it('kierron ulkopuoliseen liikkeeseen vaihdettaessa kierto säilyy', () => {
    const press = { ...session.blocks[1].exercises[0] }
    const swapped = swapExercise(session, 0, 0, press)
    expect(swapped.blocks[0].exercises[0].rotation).toHaveLength(3)
  })
})

describe('vaihtuva liike ja poikkeamat', () => {
  it('vuorossa oleva tai käsin valittu kierron liike ei ole poikkeama', () => {
    expect(findDeviations(legDay, done('w', '2026-11-16T17:00:00Z', 'deadlift'))).toEqual([])
    expect(findDeviations(legDay, done('w', '2026-11-16T17:00:00Z', 'front-squat', 4))).toEqual([])
  })

  it('sarjamäärä verrataan tehdyn liikkeen omaan tavoitteeseen ja päivittyy vain sille', () => {
    const deviations = findDeviations(legDay, done('w', '2026-11-16T17:00:00Z', 'deadlift', 4))
    expect(deviations).toMatchObject([{ kind: 'sets', exerciseId: 'deadlift', from: 3, to: 4 }])
    const updated = applyDeviations(legDay, deviations, () => 'new')
    const options = optionsOf(updated.blocks[0].exercises[0])
    expect(options.map((o) => o.sets.length)).toEqual([3, 4, 4])
  })

  it('kierron ulkopuolinen liike on edelleen vaihto', () => {
    expect(findDeviations(legDay, done('w', '2026-11-16T17:00:00Z', 'hack-squat'))).toMatchObject([
      { kind: 'swap', fromId: 'back-squat', toId: 'hack-squat' },
    ])
  })
})

describe('vaihtuvan liikkeen muokkaus', () => {
  const plain: WorkoutTemplate = {
    id: 't',
    name: 'T',
    blocks: [{ id: 'b', restSec: 90, exercises: [{ exerciseId: 'back-squat', sets: targets(3, 8) }] }],
  }
  const at = { block: 0, exercise: 0 }

  it('lisäys kiertoon: sama mittaustapa saa ensimmäisen tavoitteet, tuplaa ei lisätä', () => {
    const rotating = addToRotation(plain, at, exercise('deadlift'), 'weight_reps')
    expect(rotating.blocks[0].exercises[0].alternatives).toEqual([{ exerciseId: 'deadlift', sets: targets(3, 8) }])
    expect(addToRotation(rotating, at, exercise('deadlift'), 'weight_reps')).toBe(rotating)
    const plank = addToRotation(plain, at, exercise('plank'), 'weight_reps').blocks[0].exercises[0].alternatives
    expect(plank?.[0].sets[0].durationSec).toBe(30)
  })

  it('tavoitteet muuttuvat vain valitulle kierron liikkeelle', () => {
    const changed = setTarget(legDay, { ...at, option: 1 }, 'weight_reps', { value: 3 })
    const options = optionsOf(changed.blocks[0].exercises[0])
    expect(options.map((o) => targetOf(o).reps)).toEqual([8, 3, 6])
  })

  it('poisto: ensimmäisen tilalle nousee seuraava, viimeisenä jäävä on tavallinen liike', () => {
    const withoutFirst = removeFromRotation(legDay, { ...at, option: 0 })
    expect(optionsOf(withoutFirst.blocks[0].exercises[0]).map((o) => o.exerciseId)).toEqual(['deadlift', 'front-squat'])
    expect(withoutFirst.blocks[0].exercises[0].sets).toEqual(targets(3, 5))
    const single = removeFromRotation(withoutFirst, { ...at, option: 1 })
    expect(single.blocks[0].exercises[0]).toEqual({ exerciseId: 'deadlift', sets: targets(3, 5) })
  })
})
