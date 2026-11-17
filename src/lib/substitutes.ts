import { CURATED_SUBSTITUTES, GROUP_MUSCLES } from '@/data/exerciseMuscles'
import type { Exercise, Muscle } from '@/types/workout'

/**
 * Korvaavat liikkeet: liikkeet, jotka treenaavat käytännössä samoja päälihaksia,
 * esimerkiksi kun laite on varattu. Käyttäjän kiinnittämät tulevat aina ensin, sitten
 * kirjaston käsin valitut korvaajat ja lopuksi lihasvertailun ehdotukset.
 */

/** Ehdotukseen pääsee liike, jolla vähintään puolet lihaksista on yhteisiä. */
const MIN_SIMILARITY = 0.5
const MAX_SUBSTITUTES = 4

/** Oma liike ilman lihasvalintaa: lihakset arvioidaan lihasryhmästä. */
export function musclesOf(exercise: Exercise): Muscle[] {
  return exercise.muscles ?? GROUP_MUSCLES[exercise.muscleGroup]
}

/**
 * Yhteisten lihasten osuus kaikista kahden liikkeen lihaksista (0–1). Näin kyykylle
 * jalkaprässi (etureidet ja pakarat) on täysi osuma ja reiden ojennus (etureidet) puolikas.
 */
export function similarity(a: Muscle[], b: Muscle[]): number {
  const union = new Set([...a, ...b])
  if (!union.size) return 0
  const shared = a.filter((muscle) => b.includes(muscle)).length
  return shared / union.size
}

/**
 * Liikkeen korvaajat parhaasta alkaen. Tasapisteissä ensin käyttäjän eniten tekemät
 * liikkeet (frequent: tunnisteet yleisimmästä alkaen), sitten samalla tavalla tehtävät
 * (sama mittaustapa ja molemmat puolet kerralla tai yksi kerrallaan, kuten kyykylle
 * jalkaprässi ennen askelkyykkyä) ja lopuksi aakkosjärjestys. Kiinnitetyt (pinned)
 * näkyvät kaikki kiinnitysjärjestyksessä, ja niiden perään tulee enintään neljä ehdotusta.
 */
export function substitutesFor(
  exercise: Exercise,
  all: Exercise[],
  frequent: string[] = [],
  pinned: string[] = [],
): Exercise[] {
  const byId = new Map(all.map((e) => [e.id, e]))
  const lookup = (ids: string[]) => ids.map((id) => byId.get(id)).filter((e): e is Exercise => e !== undefined)
  const pinnedExercises = lookup(pinned).filter((e) => e.id !== exercise.id)
  const curated = lookup(CURATED_SUBSTITUTES[exercise.id] ?? []).filter((e) => !pinnedExercises.includes(e))

  const own = musclesOf(exercise)
  const rank = (id: string) => {
    const index = frequent.indexOf(id)
    return index === -1 ? frequent.length : index
  }
  const differs = (e: Exercise) =>
    Number(e.measurement !== exercise.measurement) + Number(e.perSide !== exercise.perSide)
  const scored = all
    .filter((e) => e.id !== exercise.id && !curated.includes(e) && !pinnedExercises.includes(e))
    .map((e) => ({ exercise: e, score: similarity(own, musclesOf(e)) }))
    .filter((s) => s.score >= MIN_SIMILARITY)
    .sort(
      (a, b) =>
        b.score - a.score ||
        rank(a.exercise.id) - rank(b.exercise.id) ||
        differs(a.exercise) - differs(b.exercise) ||
        a.exercise.name.localeCompare(b.exercise.name, 'fi'),
    )
    .map((s) => s.exercise)

  return [...pinnedExercises, ...[...curated, ...scored].slice(0, MAX_SUBSTITUTES)]
}
