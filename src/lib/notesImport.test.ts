import { describe, expect, it } from 'vitest'
import { EXERCISE_LIBRARY } from '@/data/exerciseLibrary'
import { matchExercise, parseNotes, parseSets, setsSummary, toWorkout } from './notesImport'

const today = new Date(2026, 10, 14) // la 14.11.2026

describe('sarjojen tulkinta', () => {
  it('sarjat × toistot ja paino', () => {
    expect(parseSets('3x10 60kg')).toEqual(Array(3).fill({ reps: 10, weightKg: 60 }))
    expect(parseSets('3x8 45')).toEqual(Array(3).fill({ reps: 8, weightKg: 45 }))
    expect(parseSets('3 x 12 @ 22,5 kg')).toEqual(Array(3).fill({ reps: 12, weightKg: 22.5 }))
  })

  it('kehonpaino: pieni ensimmäinen luku on sarjamäärä', () => {
    expect(parseSets('3x10')).toEqual(Array(3).fill({ reps: 10 }))
  })

  it('paino × toistot sarja kerrallaan', () => {
    expect(parseSets('60x10')).toEqual([{ weightKg: 60, reps: 10 }])
    expect(parseSets('60x10 60x10 65x8')).toEqual([
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 10 },
      { weightKg: 65, reps: 8 },
    ])
    expect(parseSets('45x8, 45x8, 47,5x6')).toEqual([
      { weightKg: 45, reps: 8 },
      { weightKg: 45, reps: 8 },
      { weightKg: 47.5, reps: 6 },
    ])
    expect(parseSets('8kg x 12')).toEqual([{ weightKg: 8, reps: 12 }])
  })

  it('paino / toistot', () => {
    expect(parseSets('60/10 60/10 62,5/8')).toEqual([
      { weightKg: 60, reps: 10 },
      { weightKg: 60, reps: 10 },
      { weightKg: 62.5, reps: 8 },
    ])
  })

  it('paino ensin, sitten toistolista', () => {
    expect(parseSets('45kg 8-8-6')).toEqual([
      { weightKg: 45, reps: 8 },
      { weightKg: 45, reps: 8 },
      { weightKg: 45, reps: 6 },
    ])
    expect(parseSets('10-10-8')).toEqual([{ reps: 10 }, { reps: 10 }, { reps: 8 }])
  })

  it('tuntematon muoto palauttaa null', () => {
    expect(parseSets('kolme sarjaa raskaasti')).toBeNull()
    expect(parseSets('3x10 60kg ja vähän lisää')).toBeNull()
  })
})

describe('muistiinpanojen tulkinta', () => {
  it('päivämäärä aloittaa treenin, loppu on nimi, vuosi päätellään', () => {
    const [w] = parseNotes('Ma 10.11. Treeni 1\nJalkakyykky 3x10 60kg\nPenkki 3x8 45', today)
    expect(w).toMatchObject({ date: '2026-11-10', title: 'Treeni 1', dateGuessed: false })
    expect(w.exercises.map((e) => [e.name, e.sets.length])).toEqual([
      ['Jalkakyykky', 3],
      ['Penkki', 3],
    ])
  })

  it('tulevaisuuden päivämäärä ilman vuotta on viime vuodelta', () => {
    expect(parseNotes('20.12.\nKyykky 3x10 50', today)[0].date).toBe('2025-12-20')
    expect(parseNotes('3.2.2025\nKyykky 3x10 50', today)[0].date).toBe('2025-02-03')
  })

  it('sarjarivit liikkeen alla', () => {
    const [w] = parseNotes('14.11.\nKyykky\n60x10\n60x10\n65x8\nPenkki 45x8, 45x8, 47,5x6', today)
    expect(w.exercises.map((e) => [e.name, e.sets.length])).toEqual([
      ['Kyykky', 3],
      ['Penkki', 3],
    ])
    expect(w.unrecognized).toEqual([])
  })

  it('useampi treeni samassa tekstissä', () => {
    const workouts = parseNotes('12.11.\nKyykky 60/10 60/10\n\n14.11.\nPenkki 45kg 8-8-6', today)
    expect(workouts.map((w) => w.date)).toEqual(['2026-11-12', '2026-11-14'])
  })

  it('vapaa teksti jää tunnistamatta, mitään ei katoa', () => {
    const [w] = parseNotes(
      '14.11.\nTänään jalat. Kyykkyä kolme\nsarjaa 60 kilolla, viimeinen\nKyykky 3x10 60',
      today,
    )
    expect(w.exercises.map((e) => e.name)).toEqual(['Kyykky'])
    expect(w.unrecognized).toEqual(['Tänään jalat. Kyykkyä kolme', 'sarjaa 60 kilolla, viimeinen'])
  })

  it('ilman päivämäärää käytetään tätä päivää ja kerrotaan siitä', () => {
    const [w] = parseNotes('Kyykky 3x10 60', today)
    expect(w).toMatchObject({ date: '2026-11-14', dateGuessed: true })
  })

  it('luettelomerkit ja kaksoispiste ohitetaan', () => {
    const [w] = parseNotes('14.11.\n- Kyykky: 3x10 60kg\n• Soutu – 3x12 40 kg', today)
    expect(w.exercises.map((e) => e.name)).toEqual(['Kyykky', 'Soutu'])
  })
})

describe('treeneiksi', () => {
  it('liike yhdistetään kirjastoon samalla haulla kuin valitsimessa', () => {
    expect(matchExercise('Penkki', EXERCISE_LIBRARY)?.name).toBe('Penkkipunnerrus')
    expect(matchExercise('Jalkakyykky', EXERCISE_LIBRARY)?.id).toBe('back-squat')
    expect(matchExercise('Tuntematon kummajainen', EXERCISE_LIBRARY)).toBeUndefined()
  })

  it('tuotu treeni on salitreeni, jossa kaikki sarjat on tehty', () => {
    const [parsed] = parseNotes('10.11. Treeni 1\nJalkakyykky 3x10 60kg', today)
    const workout = toWorkout(parsed, () => 'back-squat', 'w1')
    expect(workout).toMatchObject({ sport: 'strength', date: '2026-11-10', title: 'Treeni 1' })
    expect(workout.logged?.blocks?.[0].exercises[0].sets[0]).toEqual({ done: true, reps: 10, weightKg: 60 })
  })

  it('sarjojen yhteenveto', () => {
    expect(setsSummary([{ reps: 10, weightKg: 60 }, { reps: 10, weightKg: 60 }])).toBe('2 × 10 · 60 kg')
    expect(setsSummary([{ weightKg: 45, reps: 8 }, { weightKg: 47.5, reps: 6 }])).toBe('45 kg × 8, 47,5 kg × 6')
    expect(setsSummary([{ reps: 10, weightKg: 13 }, { reps: 9, weightKg: 13 }, { reps: 9, weightKg: 13 }])).toBe('10, 9, 9 · 13 kg')
    expect(setsSummary([{ reps: 10 }, { reps: 10 }])).toBe('2 × 10')
  })
})

describe('Marian muistiinpanot', () => {
  const NOTES = `Treeni B 4.10.

–  Maastaveto TRAP: 15, 15, 15 | 27kg
–  Pystypunnerrus  L: 10, 9, 9 | 13kg (per ✋)
–  Taljasoutu L: 12, 12, 10 | 32kg
–  Reisiloitonnus L: 12, 12, 12 | 55kg
–  Face pull: 15, 12, 12 | 18kg
–  Hauiskääntö TL: 12, 10, 10 | 23kg

Treeni A 6.10.

–  Kyykyt LT: 13, 10, 10 | 20kg, 30kg
–  Penkkipunnerrus KP: 12, 12, 12 | 7kg (per ✋)
–  Pohjenousut L:  15, 15, 15 | 10kg
–  Ylätalja: 15, 15, 15 | 32kg
–  Askelkyykyt JP: 10, 10 | (per 🦶)
–  Ojentajapunnerrus TL: 12, 12, 12 |

Treeni A 8.11.

–  Ylätalja: 12, 12, 15 | 32, 26,5kg`

  const workouts = parseNotes(NOTES, today)

  it('otsikko ennen päivämäärää', () => {
    expect(workouts.map((w) => [w.title, w.date])).toEqual([
      ['Treeni B', '2026-10-04'],
      ['Treeni A', '2026-10-06'],
      ['Treeni A', '2026-11-08'],
    ])
    expect(workouts.every((w) => !w.unrecognized.length)).toBe(true)
  })

  it('toistot | paino, viimeinen paino jatkuu, tyhjä paino on kehonpaino', () => {
    const a = workouts[1].exercises
    expect(a[0].sets).toEqual([
      { reps: 13, weightKg: 20 },
      { reps: 10, weightKg: 30 },
      { reps: 10, weightKg: 30 },
    ])
    expect(a[4].sets).toEqual([{ reps: 10 }, { reps: 10 }])
    expect(a[5].sets).toEqual(Array(3).fill({ reps: 12 }))
    expect(workouts[2].exercises[0].sets.map((s) => s.weightKg)).toEqual([32, 26.5, 26.5])
  })

  it('liikkeet osuvat kirjastoon lyhenteiden ja monikon avulla', () => {
    const names = workouts.flatMap((w) => w.exercises).map((e) => matchExercise(e.name, EXERCISE_LIBRARY)?.name)
    expect(names).toEqual([
      'Maastaveto trap-tangolla',
      'Pystypunnerrus laitteessa',
      'Taljasoutu',
      'Reisiloitonnus',
      'Face pull',
      'Hauiskääntö taljalla',
      'Jalkakyykky',
      'Penkkipunnerrus käsipainoilla',
      'Pohjenousu',
      'Ylätalja',
      'Askelkyykky',
      'Ojentajapunnerrus taljalla',
      'Ylätalja',
    ])
  })
})

describe('kaverin muistiinpanot', () => {
  const NOTES = `21.11. Duo
Penkki
- L 20, 40, 50
- H: Oikee ranne vähän arkan. Next 62.5kg kunhan ranteet lämpätään hyvin.
- 60kg x 10, 10, 10

Kyykky
- L: 20, 50, 70
- H: Tänään 80 jotta saa varmuutta. Next varovainen 85kg
- HH: 7, 7, 5
- 80kg x 11, 10, 10

Ylätalja
- L 50
- 65kg x 11, 9, (9 + 5 x 55kg)

26.1.
Takakyykky
- 20kgx10
- 40kgx10
- 50x8
- 70x4, 4
- seuraaval kerral leveempi jalka

Sivuolkapää
- 4x10, 13 (kaikki mitä lähtee), ~13, 15
-- ei tarvii niin ylös. 90° MAX

Vinopenkki KPlla
- 12x10, 4 (nopee hyyty)

Selkä ylätaljalla (lat pulldown)
- 35x15 skip loput kun liian kevyt
- 45x11, 10

Hacksquat
- 80x5 (varovaista testiä), 11, 12

10.8. Veto
- joku 1h boulderointia salmikses

7.8. sekalautasannos kluuvi
Pohkeet telineessä
- 30kg x 10, 11, 12

Vatsakierrot
- (15, 15, 15)
- Perusvatsat

5.8. rinta kluuvi
Chest fly (pec machine)
- 15kg x 10, 8
- 12.5kg x 10

Dipit penkillä
- 10, 15, 15

Mave
- 40kg x 10, 10, 10 + DS
- N: 50kg`

  const workouts = parseNotes(NOTES, today)
  const byDate = (date: string) => workouts.find((w) => w.date === date)!

  it('päivämäärät ja otsikot', () => {
    expect(workouts.map((w) => [w.date, w.title])).toEqual([
      ['2025-11-21', 'Duo'],
      ['2026-01-26', ''],
      ['2026-08-10', 'Veto'],
      ['2026-08-07', 'sekalautasannos kluuvi'],
      ['2026-08-05', 'rinta kluuvi'],
    ])
  })

  it('paino × toistolista, lämmittelyt ja huomiot eivät ole liikkeitä', () => {
    const duo = byDate('2025-11-21')
    expect(duo.exercises.map((e) => e.name)).toEqual(['Penkki', 'Kyykky', 'Ylätalja'])
    expect(duo.exercises[0].sets).toEqual(Array(3).fill({ weightKg: 60, reps: 10 }))
    expect(duo.exercises[2].sets).toEqual([
      { weightKg: 65, reps: 11 },
      { weightKg: 65, reps: 9 },
    ])
    expect(duo.unrecognized).toContain('L 20, 40, 50')
    expect(duo.unrecognized).toContain('HH: 7, 7, 5')
  })

  it('sarjat riveittäin, kommentit muistiinpanoksi', () => {
    const day = byDate('2026-01-26')
    expect(day.exercises.map((e) => [e.name, e.sets.length])).toEqual([
      ['Takakyykky', 5],
      ['Sivuolkapää', 4],
      ['Vinopenkki KPlla', 2],
      ['Selkä ylätaljalla', 3],
      ['Hacksquat', 3],
    ])
    expect(day.exercises[1].sets[0]).toEqual({ weightKg: 4, reps: 10 })
    expect(day.unrecognized).toEqual([
      'seuraaval kerral leveempi jalka',
      'ei tarvii niin ylös. 90° MAX',
      'Selkä ylätaljalla: skip loput kun liian kevyt',
    ])
  })

  it('pelkkä huomio ilman liikkeitä ja kokonaan sulkeissa olevat toistot', () => {
    expect(byDate('2026-08-10').exercises).toEqual([])
    expect(byDate('2026-08-10').unrecognized).toEqual(['joku 1h boulderointia salmikses'])
    const mixed = byDate('2026-08-07')
    expect(mixed.exercises.map((e) => [e.name, e.sets.length])).toEqual([
      ['Pohkeet telineessä', 3],
      ['Vatsakierrot', 3],
    ])
    expect(mixed.unrecognized).toEqual(['Perusvatsat'])
  })

  it('liikkeet osuvat kirjastoon slangista ja sulkeista', () => {
    const names = workouts
      .flatMap((w) => w.exercises)
      .map((e) => matchExercise(e.name, EXERCISE_LIBRARY, e.hint)?.name ?? `(uusi) ${e.name}`)
    expect(names).toEqual([
      'Penkkipunnerrus',
      'Jalkakyykky',
      'Ylätalja',
      'Jalkakyykky',
      'Sivunosto',
      'Vinopenkki käsipainoilla',
      'Ylätalja',
      'Hack-kyykky',
      'Pohjenousu',
      '(uusi) Vatsakierrot',
      'Rintaflyes',
      'Penkkidippi',
      'Maastaveto',
    ])
  })

  it('tuntematon teksti tallentuu treenin muistiinpanoksi', () => {
    const workout = toWorkout(byDate('2026-08-05'), () => 'x', 'w1')
    expect(workout.logged?.notes).toBe('Mave: + DS\nN: 50kg')
  })
})
