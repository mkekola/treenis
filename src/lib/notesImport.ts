import { normalize, scoreExercise } from '@/lib/exerciseSearch'
import { localDate } from '@/lib/session'
import { DEFAULT_REST_SEC } from '@/lib/template'
import type { Exercise, Workout } from '@/types/workout'

/**
 * Vanhojen treenimuistiinpanojen tulkinta. Puhelimen muistiinpanoissa jokainen
 * kirjoittaa omalla tavallaan, joten säännöt tunnistavat yleisimmät muodot ja
 * kaikki muu palautetaan tunnistamattomina riveinä, jotka tallennetaan treenin
 * muistiinpanoksi: mitään ei katoa.
 *
 *   14.11. Treeni 1          päivämäärä aloittaa treenin, loppu on nimi
 *   Jalkakyykky 3x10 60kg    sarjat × toistot, paino
 *   Kyykky 60x10 60x10 65x8  paino × toistot sarja kerrallaan
 *   60x10                    sarja omalla rivillään edellisen liikkeen alle
 *   Penkki 45/8 45/8         paino / toistot
 *   Penkki 45kg 8-8-6        paino, sitten toistot
 *   Treeni B 4.10.           päivämäärä myös otsikon perässä
 *   Kyykyt LT: 15, 10, 10 | 20kg, 30kg   toistot | paino (viimeinen paino jatkuu)
 *   Penkki                   liike omalla rivillään,
 *   - 60kg x 10, 10, 10      sarjat viivariveinä: paino × toistolista
 *   - L 20, 40 / - H: ...    lyhenne alussa (lämmittely, huomio): muistiinpanoksi
 *   - 35x15 skip loput       sarjojen perässä oleva kommentti: muistiinpanoksi
 *
 * Sulkeissa oleva huomautus, kuten "(per ✋)", ohitetaan, mutta kokonaan sulkeissa
 * oleva rivi ("(15, 15, 15)") luetaan. Liikkeen nimen sulkeet ("(lat pulldown)")
 * auttavat tunnistamaan liikkeen.
 */

export interface ParsedSet {
  reps?: number
  weightKg?: number
}

export interface ParsedExercise {
  name: string
  sets: ParsedSet[]
  /** Nimen perässä sulkeissa ollut teksti, esim. "lat pulldown". Auttaa tunnistuksessa. */
  hint?: string
}

export interface ParsedWorkout {
  date: string
  title: string
  /** Päivämäärää ei löytynyt, joten käytettiin tätä päivää. */
  dateGuessed: boolean
  exercises: ParsedExercise[]
  /** Rivit, joita ei tunnistettu liikkeiksi tai sarjoiksi. Tallennetaan muistiinpanoksi. */
  unrecognized: string[]
}

const WEEKDAY = '(?:ma|ti|ke|to|pe|la|su)[a-zäö]*\\.?\\s+'
const DATE_LINE = new RegExp(`^(?:${WEEKDAY})?(\\d{1,2})\\.(\\d{1,2})\\.?(\\d{2,4})?\\.?(?:\\s+(.*))?$`, 'i')
/** Otsikko ensin, päivämäärä lopussa: "Treeni B 4.10." Otsikossa ei saa olla numeroita ennen päivää. */
const TITLE_DATE_LINE = /^([^\d:|]+?)\s+(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?\.?$/

/** Päivämäärä ilman vuotta on viimeisin sellainen päivä, joka ei ole tulevaisuudessa. */
function parseDate(day: number, month: number, year: string | undefined, today: Date): string | null {
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  let y = year ? Number(year.length === 2 ? `20${year}` : year) : today.getFullYear()
  let date = new Date(y, month - 1, day)
  if (date.getMonth() !== month - 1) return null
  if (!year && date > today) {
    y -= 1
    date = new Date(y, month - 1, day)
  }
  return localDate(date)
}

/** Desimaalipilkku painoissa ("47,5kg", "22,5x10"). Toistolistat ("8,8,6") jäävät ennalleen. */
function normalizeSpec(text: string): string {
  return text
    .toLowerCase()
    .replace(/[×*]/g, 'x')
    .replace(/~/g, '')
    .replace(/(\d),(25|5|75)(?=\s*(?:kg|x|\/|\s|$))/g, '$1.$2')
}

const NUMBER = '(\\d+(?:\\.\\d+)?)'

/** Liikerivin tai sarjarivin numero-osa sarjoiksi. null, jos muotoa ei tunnisteta. */
export function parseSets(spec: string): ParsedSet[] | null {
  const text = normalizeSpec(spec).trim()
  if (!text) return []

  // Toistot | paino: "15, 15, 15 | 27kg", "15, 10, 10 | 20kg, 30kg", "12, 12, 12 |".
  // Painoja voi olla vähemmän kuin sarjoja, jolloin viimeinen paino jatkuu.
  if (text.includes('|')) {
    const [left, right = ''] = text.split('|')
    const reps = left.trim().match(/^\d+(?:\s*[-,]\s*\d+)*$/)
    if (!reps) return null
    const weights = [...right.matchAll(new RegExp(NUMBER, 'g'))].map((m) => Number(m[1]))
    if (right.replace(/kg|[\d.,\s]/g, '')) return null
    return reps[0].split(/\s*[-,]\s*/).map((r, i) => ({
      reps: Number(r),
      ...(weights.length ? { weightKg: weights[Math.min(i, weights.length - 1)] } : {}),
    }))
  }

  // Paino / toistot: "60/10 60/10"
  const slashes = [...text.matchAll(new RegExp(`${NUMBER}\\s*(?:kg)?\\s*\\/\\s*(\\d+)`, 'g'))]
  if (slashes.length) return slashes.map((m) => ({ weightKg: Number(m[1]), reps: Number(m[2]) }))

  // Paino ja toistolista: "45kg 8-8-6", "45 8,8,6"
  const list = text.match(new RegExp(`^${NUMBER}\\s*(kg)?\\s+(\\d+(?:\\s*[-,]\\s*\\d+)+)$`))
  if (list) return list[3].split(/\s*[-,]\s*/).map((reps) => ({ weightKg: Number(list[1]), reps: Number(reps) }))

  // Pelkkä toistolista ilman painoa: "10-10-8"
  const repsOnly = text.match(/^(\d+(?:\s*[-,]\s*\d+)+)$/)
  if (repsOnly) return repsOnly[1].split(/\s*[-,]\s*/).map((reps) => ({ reps: Number(reps) }))

  const pairs = [...text.matchAll(new RegExp(`${NUMBER}\\s*(kg)?\\s*x\\s*(\\d+)`, 'g'))]
  const rest = text.replace(new RegExp(`${NUMBER}\\s*(kg)?\\s*x\\s*(\\d+)`, 'g'), ' ').trim()

  // Useampi pari: jokainen on paino × toistot. "60x10 60x10 65x8"
  if (pairs.length > 1 && !rest.replace(/[,;\s]/g, '')) {
    return pairs.map((m) => ({ weightKg: Number(m[1]), reps: Number(m[3]) }))
  }

  if (pairs.length === 1) {
    const [, a, kg, b] = pairs[0]
    const weight = rest.match(new RegExp(`^(?:@|a|à)?\\s*${NUMBER}\\s*(kg)?$`))
    // Sarjat × toistot ja erillinen paino: "3x10 60kg", "3x10 @ 60"
    if (weight && !kg) {
      return Array.from({ length: Number(a) }, () => ({ reps: Number(b), weightKg: Number(weight[1]) }))
    }
    // Paino × toistolista: "60kg x 10, 10, 10", "70x4, 4"
    const more = rest.match(/^[,\s]*(\d+(?:\s*,\s*\d+)*)\s*,?$/)
    if (more) return [b, ...more[1].split(/\s*,\s*/)].map((reps) => ({ weightKg: Number(a), reps: Number(reps) }))
    if (rest.replace(/[,\s]/g, '')) return null
    // Yksi pari ilman painoa: pieni ensimmäinen luku on sarjamäärä ("3x10" kehonpainolla),
    // suuri tai kiloilla merkitty on paino ("60x10", "8kg x 12").
    if (!kg && Number.isInteger(Number(a)) && Number(a) <= 10) {
      return Array.from({ length: Number(a) }, () => ({ reps: Number(b) }))
    }
    return [{ weightKg: Number(a), reps: Number(b) }]
  }

  return null
}

/** Sarjojen perässä oleva kommentti erilleen: "35x15 skip loput", "55kg x 12, 12 + DS". */
function splitComment(spec: string): { numeric: string; comment: string } {
  const tokens = spec.trim().split(/\s+/).filter(Boolean)
  const index = tokens.findIndex((token) => !/^[~\d.,x×*/|@\-–]*(?:kg[\d.,x×*/|@\-–]*)?$/i.test(token))
  if (index === -1) return { numeric: tokens.join(' '), comment: '' }
  return { numeric: tokens.slice(0, index).join(' '), comment: tokens.slice(index).join(' ') }
}

/** Lyhenne rivin alussa: L (lämmittely), H (huomio), N (next) ja muut. Ei liike. */
const LABEL = /^[A-ZÄÖ]{1,2}$/

/** Rivin alku ennen ensimmäistä numeroa on liikkeen nimi. */
function splitLine(line: string): { name: string; spec: string } {
  const match = line.match(/^([^\d]*?)[\s:\-–]*(\d.*)?$/)
  return { name: (match?.[1] ?? line).replace(/[:\-–]+$/, '').trim(), spec: match?.[2] ?? '' }
}

export function parseNotes(text: string, today: Date): ParsedWorkout[] {
  const workouts: ParsedWorkout[] = []
  let current: ParsedWorkout | null = null
  let exercise: ParsedExercise | null = null

  /** Liike ilman yhtään sarjaa on todennäköisesti vapaata tekstiä: tunnistamaton rivi samalle paikalle. */
  const close = () => {
    const done: ParsedExercise | null = exercise
    const workout: ParsedWorkout | null = current
    if (done && workout && !done.sets.length) {
      workout.exercises = workout.exercises.filter((e) => e !== done)
      workout.unrecognized.push(done.name)
    }
    exercise = null
  }

  const start = (date: string, title: string, dateGuessed: boolean): ParsedWorkout => {
    close()
    const workout: ParsedWorkout = { date, title, dateGuessed, exercises: [], unrecognized: [] }
    workouts.push(workout)
    current = workout
    return workout
  }

  for (const raw of text.split(/\r?\n/)) {
    const bulleted = /^\s*[•\-–—*]/.test(raw)
    let line = raw.replace(/^[\s•\-–—*]+/, '').trim()
    // Kokonaan sulkeissa oleva rivi on sisältöä, muualla sulkeet ovat huomautuksia.
    const wrapped = line.match(/^\(([^)]*)\)$/)
    if (wrapped) line = wrapped[1].trim()
    const hint = [...line.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim()).join(' ')
    line = line.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
    if (!line) continue

    const dateMatch = line.match(DATE_LINE)
    const date = dateMatch && parseDate(Number(dateMatch[1]), Number(dateMatch[2]), dateMatch[3], today)
    if (date) {
      start(date, dateMatch?.[4]?.trim() ?? '', false)
      continue
    }
    const titleMatch = line.match(TITLE_DATE_LINE)
    const titleDate = titleMatch && parseDate(Number(titleMatch[2]), Number(titleMatch[3]), titleMatch[4], today)
    if (titleDate) {
      start(titleDate, titleMatch?.[1]?.trim() ?? '', false)
      continue
    }

    const workout: ParsedWorkout = current ?? start(localDate(today), '', true)

    // Lyhenteellä alkava rivi on huomio, ei liike. Liike jatkuu sen jälkeen.
    if (LABEL.test(line.split(/[\s:]+/)[0])) {
      workout.unrecognized.push(line)
      continue
    }

    const { name, spec } = splitLine(line)
    const { numeric, comment } = splitComment(spec)
    const sets = spec && !numeric ? null : parseSets(numeric)

    if (sets === null) {
      // Viivarivi liikkeen alla on huomio, eikä se lopeta liikettä. Muu teksti lopettaa.
      if (!bulleted) close()
      workout.unrecognized.push(line)
      continue
    }
    if (bulleted && !spec && exercise) {
      workout.unrecognized.push(line)
      continue
    }
    if (!name) {
      // Sarjarivi kuuluu edelliselle liikkeelle.
      const previous: ParsedExercise | null = exercise
      if (previous && sets.length) {
        previous.sets.push(...sets)
        if (comment) workout.unrecognized.push(`${previous.name}: ${comment}`)
      } else workout.unrecognized.push(line)
      continue
    }
    close()
    exercise = { name, sets, ...(hint ? { hint } : {}) }
    workout.exercises.push(exercise)
    if (comment) workout.unrecognized.push(`${name}: ${comment}`)
  }
  close()

  return workouts.filter((w) => w.exercises.length || w.unrecognized.length)
}

// ---------------------------------------------------------- treeneiksi

/** Välinelyhenteet muistiinpanoissa ja kirjaston nimissä: "Penkkipunnerrus KP" → "käsipainoilla". */
const EQUIPMENT: Record<string, string> = {
  KP: 'käsipainoilla',
  TL: 'taljalla',
  L: 'laitteessa',
  LT: 'tangolla',
  T: 'tangolla',
  TRAP: 'trap-tangolla',
}

/** Monikko yksiköksi, myös astevaihtelu: "kyykyt" → "kyykky", "pohjenousut" → "pohjenousu". */
function singulars(word: string): string[] {
  if (!word.endsWith('t')) return []
  const stem = word.slice(0, -1)
  const doubled = stem.replace(/([bcdfghjklmnpqrstvwxz])([aeiouyäö])$/i, '$1$1$2')
  return doubled === stem ? [stem] : [stem, doubled]
}

/**
 * Paras osuma liikekirjastosta ja omista liikkeistä. Hakuehdot järjestyksessä:
 * nimi sellaisenaan, välinelyhenne auki kirjoitettuna, nimi ilman lyhennettä ja
 * yksikkömuotona. Paras pisteytys voittaa, tasapelissä aiempi hakuehto.
 * Heikot osumat (vain hakusanan osa) jätetään pois, jolloin liike luodaan uutena.
 */
export function matchExercise(name: string, exercises: Exercise[], hint?: string): Exercise | undefined {
  const words = name.trim().split(/\s+/)
  const codes: string[] = []
  // Lyhenne voi olla taivutettu: "Vinopenkki KPlla".
  const code = (word: string) => word.match(/^([A-ZÄÖ]{1,4})(?:lla|llä|ssa|ssä|lta|ltä)?$/)?.[1]
  while (words.length > 1 && code(words[words.length - 1])) codes.unshift(code(words.pop() as string) as string)
  const base = words.join(' ')
  const expanded = codes.map((c) => EQUIPMENT[c]).filter(Boolean)
  const first = words.length > 1 ? words[0] : ''

  const candidates = [
    name,
    ...(expanded.length ? [`${base} ${expanded.join(' ')}`] : []),
    base,
    ...singulars(base.toLowerCase()),
    ...(hint ? [hint] : []),
    // Ensimmäinen sana viimeisenä: "Pohkeet telineessä" → "pohkeet".
    ...(first ? [first, ...singulars(first.toLowerCase())] : []),
  ].map(normalize)

  let best: { exercise: Exercise; score: number } | undefined
  for (const candidate of candidates) {
    for (const exercise of exercises) {
      const score = scoreExercise(candidate, exercise)
      if (score >= 2 && (!best || score > best.score)) best = { exercise, score }
    }
  }
  return best?.exercise
}

/** Tuotu salitreeni: jokainen liike omassa lohkossaan, kaikki sarjat tehtyinä. */
export function toWorkout(
  parsed: ParsedWorkout,
  exerciseIdFor: (exercise: ParsedExercise) => string,
  id: string,
): Workout {
  return {
    id,
    sport: 'strength',
    date: parsed.date,
    title: parsed.title || 'Salitreeni',
    logged: {
      ...(parsed.unrecognized.length ? { notes: parsed.unrecognized.join('\n') } : {}),
      blocks: parsed.exercises.map((exercise, index) => ({
        id: `${id}-b${index}`,
        restSec: DEFAULT_REST_SEC,
        exercises: [
          {
            exerciseId: exerciseIdFor(exercise),
            sets: exercise.sets.map((set) => ({ done: true, ...set })),
          },
        ],
      })),
    },
  }
}

/** "3 × 10 · 60 kg", "10, 9, 9 · 13 kg" tai sarjat lueteltuina, jos painot vaihtelevat. */
export function setsSummary(sets: ParsedSet[]): string {
  const kg = (value: number) => `${String(value).replace('.', ',')} kg`
  const weight = sets[0]?.weightKg
  const sameWeight = sets.every((set) => set.weightKg === weight)
  if (!sameWeight) {
    return sets.map((set) => [set.weightKg !== undefined ? kg(set.weightKg) : null, set.reps].filter((v) => v !== null && v !== undefined).join(' × ')).join(', ')
  }
  const suffix = weight !== undefined ? ` · ${kg(weight)}` : ''
  const sameReps = sets.every((set) => set.reps === sets[0].reps)
  if (sameReps && sets.length > 1) return `${sets.length} × ${sets[0].reps ?? '?'}${suffix}`
  return `${sets.map((set) => set.reps ?? '?').join(', ')}${suffix}`
}
