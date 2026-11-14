import { MUSCLE_GROUP_LABELS } from '@/data/exerciseLibrary'
import type { Exercise } from '@/types/workout'

/**
 * Haku ei välitä isoista kirjaimista eikä ääkkösistä: "kayra" löytää "käyrän"
 * ja "ojentaja" löytää "Ojentajapushdownin". Puhelimella ä ja ö ovat helposti
 * väärin tai jäävät pois, eikä haun kuulu rangaista siitä.
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/**
 * Järjestys, parhaasta huonoimpaan:
 *   5  nimi tai hakusana on täsmälleen haettu ("penkki" → Penkkipunnerrus)
 *   4  nimi alkaa haulla
 *   3  nimi sisältää haun
 *   2  hakusana alkaa haulla
 *   1  hakusana sisältää haun, tai haku osuu lihasryhmään ("olkapää")
 * Samalla pisteellä järjestys on aakkosellinen. Tyhjä haku palauttaa kaiken.
 */
export function scoreExercise(normalizedQuery: string, exercise: Exercise): number {
  const q = normalizedQuery
  const name = normalize(exercise.name)
  const aliases = exercise.aliases.map(normalize)
  const group = normalize(MUSCLE_GROUP_LABELS[exercise.muscleGroup])

  if (name === q || aliases.includes(q)) return 5
  if (name.startsWith(q)) return 4
  if (name.includes(q)) return 3
  if (aliases.some((alias) => alias.startsWith(q))) return 2
  if (aliases.some((alias) => alias.includes(q)) || group.startsWith(q)) return 1
  return 0
}

export function searchExercises(query: string, exercises: Exercise[]): Exercise[] {
  const q = normalize(query)
  const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name, 'fi')

  if (!q) return [...exercises].sort(byName)

  const scored: { exercise: Exercise; score: number }[] = []

  for (const exercise of exercises) {
    const score = scoreExercise(q, exercise)
    if (score > 0) scored.push({ exercise, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || byName(a.exercise, b.exercise))
    .map((entry) => entry.exercise)
}
