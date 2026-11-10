import { sessionsFor } from '@/lib/history'
import { suggestNext, workingWeightKg } from '@/lib/progression'
import type {
  ActiveSession,
  SessionBlock,
  SessionExercise,
  SetRef,
} from '@/types/session'
import type {
  Block,
  BlockExercise,
  Exercise,
  Feel,
  Measurement,
  SetEntry,
  Workout,
  WorkoutTemplate,
} from '@/types/workout'

export type ExerciseLookup = (exerciseId: string) => Exercise | undefined

/**
 * Sessio on tavallista JSONia, ja jokainen toiminto palauttaa uuden session
 * vanhaa muuttamatta. Näin logiikka on testattavissa ilman käyttöliittymää,
 * ja tila voidaan tallentaa sellaisenaan. Kopiointi kulkee JSONin kautta,
 * koska Vuen reaktiiviset proxyt eivät kelpaa structuredClonelle.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Paikallinen päivä muodossa 2026-11-12. toISOString antaisi UTC-päivän, joka voi olla eri. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// ---------------------------------------------------------------- rakentaminen

export function buildExercise(
  source: BlockExercise,
  history: Workout[],
  lookup: ExerciseLookup,
): SessionExercise {
  const exercise = lookup(source.exerciseId)
  const measurement: Measurement = exercise?.measurement ?? 'weight_reps'
  const target = { sets: source.sets.length, reps: source.sets[0]?.reps ?? 0 }

  const past = sessionsFor(source.exerciseId, history)
  const suggestion = exercise ? suggestNext(exercise, target, past) : null
  const last = past[0]
  const lastKg = last ? workingWeightKg(last) : null

  let weightKg: number | undefined
  if (suggestion?.kind === 'keep') weightKg = suggestion.kg
  else if (suggestion) weightKg = suggestion.toKg
  else if (measurement === 'weight_reps' && lastKg !== null) weightKg = lastKg

  const hint =
    suggestion && suggestion.kind !== 'keep'
      ? { kind: suggestion.kind, fromKg: suggestion.fromKg, toKg: suggestion.toKg }
      : undefined

  return {
    exerciseId: source.exerciseId,
    measurement,
    target,
    previous: lastKg !== null ? { weightKg: lastKg, feel: last?.feel } : undefined,
    hint,
    sets: source.sets.map((set) => ({
      ...set,
      weightKg: measurement === 'weight_reps' ? weightKg : set.weightKg,
      done: false,
    })),
  }
}

/**
 * Uuden liikkeen oletussarjat, kun liike ei tule pohjasta. Aikaliikkeelle
 * 30 sekuntia on oletus eikä käyttäjän tieto: sen voi muuttaa sarjarivillä.
 */
export function defaultSets(measurement: Measurement, count: number, reps: number): SetEntry[] {
  return Array.from({ length: count }, () =>
    measurement === 'time' ? { durationSec: 30, done: false } : { reps, done: false },
  )
}

/**
 * Rakentaa liikkeen kesken treenin. Paino ja ehdotus tulevat liikkeen omasta
 * historiasta: tuttu liike saa edellisen kerran painon, tuntematon tyhjän
 * painon ja ensimmäisen kerran kysymyksen. Edellisen liikkeen paino ei siirry,
 * koska kyykyn paino ei kelpaa jalkaprässiin.
 */
export function newSessionExercise(args: {
  exercise: Exercise
  sets: number
  reps: number
  history: Workout[]
  lookup: ExerciseLookup
}): SessionExercise {
  const { exercise, sets, reps, history, lookup } = args
  return buildExercise(
    { exerciseId: exercise.id, sets: defaultSets(exercise.measurement, sets, reps) },
    history,
    lookup,
  )
}

/**
 * Rakentaa treenin pohjasta. Painot tulevat edellisistä kerroista ja
 * progressiosäännöstä: jos edellinen kerta oli kevyt, rivillä on valmiina
 * ehdotettu paino. Ilman pohjaa treeni alkaa tyhjänä.
 */
export function buildSession(args: {
  id: string
  now: Date
  template?: WorkoutTemplate
  history: Workout[]
  exercises: ExerciseLookup
}): ActiveSession {
  const { id, now, template, history, exercises } = args
  const timestamp = now.toISOString()

  const blocks: SessionBlock[] = (template?.blocks ?? []).map((block) => ({
    id: block.id,
    restSec: block.restSec,
    exercises: block.exercises.map((source) => buildExercise(source, history, exercises)),
  }))

  return {
    id,
    title: template?.name ?? 'Salitreeni',
    templateId: template?.id,
    startedAt: timestamp,
    updatedAt: timestamp,
    blocks,
    currentBlock: 0,
  }
}

// ----------------------------------------------------------------------- sarjat

function setAt(session: ActiveSession, ref: SetRef): SetEntry | undefined {
  return session.blocks[ref.block]?.exercises[ref.exercise]?.sets[ref.set]
}

/** Sarjan voi merkitä tehdyksi vasta kun sen pakolliset arvot on kirjattu. */
export function canComplete(set: SetEntry, measurement: Measurement): boolean {
  if (measurement === 'weight_reps') return Boolean(set.weightKg && set.weightKg > 0 && set.reps)
  if (measurement === 'reps') return Boolean(set.reps)
  return Boolean(set.durationSec)
}

/**
 * Muuttaa sarjan arvoja. Paino kopioituu liikkeen seuraaviin tekemättömiin
 * sarjoihin: kirjaat painon kerran, ja loput sarjat seuraavat sitä. Toistot
 * muuttuvat vain tässä sarjassa, koska ne vaihtelevat sarjasta toiseen.
 */
export function setValues(
  session: ActiveSession,
  ref: SetRef,
  values: Partial<Pick<SetEntry, 'weightKg' | 'reps' | 'durationSec'>>,
): ActiveSession {
  const next = clone(session)
  const set = setAt(next, ref)
  if (!set) return session

  Object.assign(set, values)

  if (values.weightKg !== undefined) {
    const sets = next.blocks[ref.block].exercises[ref.exercise].sets
    for (let i = ref.set + 1; i < sets.length; i++) {
      if (!sets[i].done) sets[i].weightKg = values.weightKg
    }
  }

  return next
}

/**
 * Merkitsee sarjan tehdyksi. Lepo alkaa kun lohkon kierros on täynnä: yhden
 * liikkeen lohkossa jokaisen sarjan jälkeen, supersarjassa vasta kun kaikki
 * lohkon liikkeet on tehty kyseiseltä kierrokselta.
 */
export function completeSet(session: ActiveSession, ref: SetRef, now: Date): ActiveSession {
  const next = clone(session)
  const block = next.blocks[ref.block]
  const exercise = block?.exercises[ref.exercise]
  const set = exercise?.sets[ref.set]
  if (!block || !exercise || !set) return session
  if (!canComplete(set, exercise.measurement)) return session

  set.done = true
  next.updatedAt = now.toISOString()

  const roundDone = block.exercises.every((e) => e.sets[ref.set] === undefined || e.sets[ref.set].done)
  next.restEndsAt = roundDone ? new Date(now.getTime() + block.restSec * 1000).toISOString() : undefined

  return next
}

export function uncompleteSet(session: ActiveSession, ref: SetRef, now: Date): ActiveSession {
  const next = clone(session)
  const set = setAt(next, ref)
  if (!set) return session
  set.done = false
  next.updatedAt = now.toISOString()
  return next
}

/** Lisää sarjan kopioimalla viimeisen sarjan arvot. */
export function addSet(session: ActiveSession, block: number, exercise: number): ActiveSession {
  const next = clone(session)
  const sets = next.blocks[block]?.exercises[exercise]?.sets
  if (!sets?.length) return session
  sets.push({ ...sets[sets.length - 1], done: false })
  return next
}

/** Viimeisen sarjan voi poistaa vain jos se on tekemättä ja liikkeelle jää vähintään yksi sarja. */
export function canRemoveSet(session: ActiveSession, block: number, exercise: number): boolean {
  const sets = session.blocks[block]?.exercises[exercise]?.sets
  return !!sets && sets.length > 1 && !sets[sets.length - 1].done
}

/** Peruu lisäyksen: poistaa viimeisen tekemättömän sarjan. Tehtyä sarjaa ei koskaan poisteta. */
export function removeLastSet(session: ActiveSession, block: number, exercise: number): ActiveSession {
  if (!canRemoveSet(session, block, exercise)) return session
  const next = clone(session)
  next.blocks[block].exercises[exercise].sets.pop()
  return next
}

export function setNotes(session: ActiveSession, notes: string): ActiveSession {
  return { ...clone(session), notes }
}

/** Liikkeen voi vaihtaa vain ennen kuin siitä on tehty yhtään sarjaa, jottei kirjattu katoa. */
export function canSwap(exercise: SessionExercise): boolean {
  return !exercise.sets.some((set) => set.done)
}

export function swapExercise(
  session: ActiveSession,
  block: number,
  exercise: number,
  replacement: SessionExercise,
): ActiveSession {
  const current = session.blocks[block]?.exercises[exercise]
  if (!current || !canSwap(current)) return session
  const next = clone(session)
  next.blocks[block].exercises[exercise] = clone(replacement)
  return next
}

/** Lisää liikkeen treenin loppuun omana lohkonaan ja siirtää sen käsillä olevaksi. */
export function addBlock(
  session: ActiveSession,
  blockId: string,
  restSec: number,
  exercise: SessionExercise,
): ActiveSession {
  const next = clone(session)
  next.blocks.push({ id: blockId, restSec, exercises: [clone(exercise)] })
  next.currentBlock = next.blocks.length - 1
  return next
}

export function skipRest(session: ActiveSession): ActiveSession {
  return { ...clone(session), restEndsAt: undefined }
}

export function setCurrentBlock(session: ActiveSession, index: number): ActiveSession {
  if (index < 0 || index >= session.blocks.length) return session
  return { ...clone(session), currentBlock: index }
}

// -------------------------------------------------------------------- tuntuma

export function isExerciseDone(exercise: SessionExercise): boolean {
  return exercise.sets.length > 0 && exercise.sets.every((set) => set.done)
}

/**
 * Tuntuma kysytään vain painoliikkeistä, koska progressiosääntö koskee vain
 * niitä, ja vain kerran: kun liike on tehty eikä kysymystä ole vielä
 * vastattu tai ohitettu.
 */
export function needsFeel(exercise: SessionExercise): boolean {
  return (
    exercise.measurement === 'weight_reps' &&
    isExerciseDone(exercise) &&
    exercise.feel === undefined &&
    !exercise.feelSkipped
  )
}

export function setFeel(
  session: ActiveSession,
  block: number,
  exercise: number,
  feel: Feel | 'skip',
): ActiveSession {
  const next = clone(session)
  const target = next.blocks[block]?.exercises[exercise]
  if (!target) return session
  if (feel === 'skip') target.feelSkipped = true
  else target.feel = feel
  return next
}

// ------------------------------------------------------------------- lopetus

export function progress(session: ActiveSession): { done: number; total: number } {
  const sets = session.blocks.flatMap((b) => b.exercises.flatMap((e) => e.sets))
  return { done: sets.filter((s) => s.done).length, total: sets.length }
}

/**
 * Muodostaa valmiin treenin. Mukaan tulee vain se mitä tehtiin: tekemättömät
 * sarjat ja liikkeet jäävät pois, jotta historia kertoo todellisen treenin
 * eikä suunnitelmaa. Kesto on oma ajastus, ja Strava korvaa sen kun mitattu
 * data saapuu.
 */
export function toWorkout(session: ActiveSession, now: Date): Workout {
  const blocks: Block[] = session.blocks
    .map((block) => ({
      id: block.id,
      restSec: block.restSec,
      exercises: block.exercises
        .map((exercise) => ({
          exerciseId: exercise.exerciseId,
          sets: exercise.sets.filter((set) => set.done),
          feel: exercise.feel,
        }))
        .filter((exercise) => exercise.sets.length > 0),
    }))
    .filter((block) => block.exercises.length > 0)

  const started = new Date(session.startedAt)

  return {
    id: session.id,
    sport: 'strength',
    date: localDate(started),
    title: session.title,
    templateId: session.templateId,
    logged: {
      startedAt: session.startedAt,
      durationSec: Math.max(0, Math.round((now.getTime() - started.getTime()) / 1000)),
      blocks,
      notes: session.notes?.trim() || undefined,
    },
  }
}
