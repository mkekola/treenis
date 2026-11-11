import { describe, expect, it } from 'vitest'
import { initialTemplates } from '@/data/initialTemplates'
import {
  applyDeviations,
  findDeviations,
  keepDeviations,
  pruneKept,
  recurringDeviations,
} from '@/lib/deviation'
import { targetOf } from '@/lib/template'
import { doneSets } from '@/test/fixtures'
import type { Block, SetEntry, Workout, WorkoutTemplate } from '@/types/workout'

const treeni1 = initialTemplates[0]

/** Treeni, joka tehtiin pohjasta sellaisenaan: kaikki sarjat tavoitteen mukaan. */
function asPlanned(template: WorkoutTemplate): Block[] {
  return template.blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: doneSets(20, entry.sets.map((s) => s.reps ?? 10)),
    })),
  }))
}

function workout(id: string, startedAt: string, blocks: Block[], templateId = treeni1.id): Workout {
  return {
    id,
    sport: 'strength',
    date: startedAt.slice(0, 10),
    title: 'Treeni 1',
    templateId,
    logged: { startedAt, blocks },
  }
}

/** Muokkaa yhden lohkon tehtyä sisältöä. */
function changeBlock(blocks: Block[], blockId: string, change: (block: Block) => Block | null): Block[] {
  return blocks.flatMap((block) => {
    if (block.id !== blockId) return [block]
    const changed = change(block)
    return changed ? [changed] : []
  })
}

const swapPulldown = (blocks: Block[]) =>
  changeBlock(blocks, 'a4', (b) => ({ ...b, exercises: [{ exerciseId: 'pull-up', sets: doneSets(0, [8, 8, 8]) }] }))

const kinds = (list: { kind: string }[]) => list.map((d) => d.kind)

describe('poikkeamien tunnistus', () => {
  it('pohjan mukaan tehty treeni ei poikkea', () => {
    expect(findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', asPlanned(treeni1)))).toEqual([])
  })

  it('toistot ja painot eivät ole poikkeamia', () => {
    const blocks = changeBlock(asPlanned(treeni1), 'a2', (b) => ({
      ...b,
      exercises: [{ exerciseId: 'dumbbell-bench-press', sets: doneSets(24, [14, 14, 13]) }],
    }))
    expect(findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', blocks))).toEqual([])
  })

  it('tunnistaa vaihdetun liikkeen', () => {
    const found = findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', swapPulldown(asPlanned(treeni1))))
    expect(found).toMatchObject([{ kind: 'swap', fromId: 'lat-pulldown', toId: 'pull-up' }])
  })

  it('tunnistaa pois jätetyn liikkeen', () => {
    const blocks = changeBlock(asPlanned(treeni1), 'a6', () => null)
    expect(findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', blocks))).toMatchObject([
      { kind: 'remove', exerciseId: 'triceps-pushdown' },
    ])
  })

  it('liike jonka sarjoja ei merkitty tehdyiksi on pois jätetty', () => {
    const blocks = changeBlock(asPlanned(treeni1), 'a6', (b) => ({
      ...b,
      exercises: [{ exerciseId: 'triceps-pushdown', sets: [{ reps: 12, done: false }] }],
    }))
    expect(kinds(findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', blocks)))).toEqual(['remove'])
  })

  it('tunnistaa lisätyn liikkeen omasta lohkostaan', () => {
    const blocks = [
      ...asPlanned(treeni1),
      { id: 'uusi-123', restSec: 60, exercises: [{ exerciseId: 'plank', sets: [{ durationSec: 45, done: true }] }] },
    ]
    expect(findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', blocks))).toMatchObject([
      { kind: 'add', key: 'add:plank', restSec: 60, sets: [{ durationSec: 45 }] },
    ])
  })

  it('tunnistaa sarjamäärän muutoksen molempiin suuntiin', () => {
    let blocks = changeBlock(asPlanned(treeni1), 'a3', (b) => ({
      ...b,
      exercises: [{ exerciseId: 'calf-raise', sets: doneSets(40, [15, 15, 15, 15]) }],
    }))
    blocks = changeBlock(blocks, 'a1', (b) => ({
      ...b,
      exercises: [{ exerciseId: 'back-squat', sets: doneSets(40, [10, 10]) }],
    }))
    expect(findDeviations(treeni1, workout('w', '2026-11-12T17:00:00Z', blocks))).toMatchObject([
      { kind: 'sets', exerciseId: 'back-squat', from: 3, to: 2 },
      { kind: 'sets', exerciseId: 'calf-raise', from: 3, to: 4 },
    ])
  })
})

describe('toistuvat poikkeamat', () => {
  const first = workout('w1', '2026-11-09T17:00:00Z', swapPulldown(asPlanned(treeni1)))
  const second = workout('w2', '2026-11-12T17:00:00Z', swapPulldown(asPlanned(treeni1)))

  it('kysytään kun sama muutos tehtiin myös edellisellä kerralla', () => {
    expect(kinds(recurringDeviations(treeni1, second, [first]))).toEqual(['swap'])
  })

  it('ei kysytä ensimmäisellä kerralla', () => {
    const normal = workout('w1', '2026-11-09T17:00:00Z', asPlanned(treeni1))
    expect(recurringDeviations(treeni1, second, [normal])).toEqual([])
    expect(recurringDeviations(treeni1, second, [])).toEqual([])
  })

  it('vertaa vain saman pohjan edelliseen kertaan', () => {
    const other = workout('w1', '2026-11-10T17:00:00Z', swapPulldown(asPlanned(treeni1)), 'template-b')
    expect(recurringDeviations(treeni1, second, [other])).toEqual([])
  })

  it('käyttää vain viimeisintä edellistä kertaa', () => {
    const normalBetween = workout('w1b', '2026-11-11T17:00:00Z', asPlanned(treeni1))
    expect(recurringDeviations(treeni1, second, [first, normalBetween])).toEqual([])
  })

  it('eri vaihto ei ole sama poikkeama', () => {
    const otherSwap = workout(
      'w1',
      '2026-11-09T17:00:00Z',
      changeBlock(asPlanned(treeni1), 'a4', (b) => ({
        ...b,
        exercises: [{ exerciseId: 'seated-cable-row', sets: doneSets(30, [12, 12, 12]) }],
      })),
    )
    expect(recurringDeviations(treeni1, second, [otherSwap])).toEqual([])
  })

  it('lisätty liike on sama, vaikka lohkon tunniste vaihtuu joka kerta', () => {
    const withPlank = (id: string, at: string, blockId: string) =>
      workout(id, at, [
        ...asPlanned(treeni1),
        { id: blockId, restSec: 90, exercises: [{ exerciseId: 'plank', sets: [{ durationSec: 45, done: true }] }] },
      ])
    const found = recurringDeviations(treeni1, withPlank('w2', '2026-11-12T17:00:00Z', 'x2'), [
      withPlank('w1', '2026-11-09T17:00:00Z', 'x1'),
    ])
    expect(kinds(found)).toEqual(['add'])
  })

  it('"Pidä vanha" -päätöksestä ei kysytä uudelleen', () => {
    const kept = keepDeviations(treeni1, recurringDeviations(treeni1, second, [first]))
    expect(recurringDeviations(kept, second, [first])).toEqual([])
  })

  it('päätös unohtuu kun poikkeama loppuu', () => {
    const kept = keepDeviations(treeni1, recurringDeviations(treeni1, second, [first]))
    const normal = workout('w3', '2026-11-15T17:00:00Z', asPlanned(treeni1))
    expect(pruneKept(kept, second).keptDeviations).toHaveLength(1)
    expect(pruneKept(kept, normal).keptDeviations).toEqual([])
  })
})

describe('pohjan päivitys', () => {
  const sets = (count: number, reps: number): SetEntry[] => Array.from({ length: count }, () => ({ reps, done: false }))
  let n = 0
  const newId = () => `uusi-${++n}`

  it('vaihtaa liikkeen ja ottaa sarjat siitä miten se tehtiin', () => {
    const current = workout('w', '2026-11-12T17:00:00Z', swapPulldown(asPlanned(treeni1)))
    const updated = applyDeviations(treeni1, findDeviations(treeni1, current), newId)
    const block = updated.blocks.find((b) => b.id === 'a4')!
    expect(block.exercises).toEqual([{ exerciseId: 'pull-up', sets: sets(3, 8) }])
    expect(findDeviations(updated, current)).toEqual([])
  })

  it('muuttaa sarjamäärän ja pitää toistotavoitteen', () => {
    const current = workout(
      'w',
      '2026-11-12T17:00:00Z',
      changeBlock(asPlanned(treeni1), 'a3', (b) => ({
        ...b,
        exercises: [{ exerciseId: 'calf-raise', sets: doneSets(40, [15, 15, 15, 12]) }],
      })),
    )
    const updated = applyDeviations(treeni1, findDeviations(treeni1, current), newId)
    expect(targetOf(updated.blocks.find((b) => b.id === 'a3')!.exercises[0])).toEqual({
      sets: 4,
      reps: 15,
      durationSec: undefined,
    })
  })

  it('poistaa liikkeen ja sen tyhjäksi jääneen lohkon', () => {
    const current = workout('w', '2026-11-12T17:00:00Z', changeBlock(asPlanned(treeni1), 'a6', () => null))
    const updated = applyDeviations(treeni1, findDeviations(treeni1, current), newId)
    expect(updated.blocks.map((b) => b.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5'])
  })

  it('lisää liikkeen loppuun omaksi lohkokseen', () => {
    const current = workout('w', '2026-11-12T17:00:00Z', [
      ...asPlanned(treeni1),
      { id: 'x', restSec: 60, exercises: [{ exerciseId: 'plank', sets: [{ durationSec: 45, done: true }, { durationSec: 45, done: true }] }] },
    ])
    const updated = applyDeviations(treeni1, findDeviations(treeni1, current), newId)
    expect(updated.blocks.at(-1)).toMatchObject({
      restSec: 60,
      exercises: [{ exerciseId: 'plank', sets: [{ durationSec: 45, done: false }, { durationSec: 45, done: false }] }],
    })
  })

  it('ei muuta alkuperäistä pohjaa', () => {
    const before = JSON.stringify(treeni1)
    const current = workout('w', '2026-11-12T17:00:00Z', swapPulldown(asPlanned(treeni1)))
    applyDeviations(treeni1, findDeviations(treeni1, current), newId)
    keepDeviations(treeni1, findDeviations(treeni1, current))
    expect(JSON.stringify(treeni1)).toBe(before)
  })
})
