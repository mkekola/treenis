import type { Block, SetEntry, WorkoutTemplate } from '@/types/workout'

/**
 * Marian nykyiset kaksi treeniä (kaksi salikertaa viikossa, 1 ja 2).
 * Tallennetaan tietokantaan ensimmäisellä käynnistyksellä, minkä jälkeen
 * pohjat elävät siellä eikä tätä tiedostoa lueta uudelleen.
 *
 * Painoja ei ole annettu, joten sarjoissa on vain toistotavoite. Ensimmäisellä
 * kerralla paino kirjataan käsin, ja siitä eteenpäin se tulee edellisestä
 * kerrasta. Lepoaika 90 s on Marian hyväksymä oletus.
 */
const DEFAULT_REST_SEC = 90

function straight(id: string, exerciseId: string, sets: number, reps: number): Block {
  const targets: SetEntry[] = Array.from({ length: sets }, () => ({ reps, done: false }))
  return {
    id,
    restSec: DEFAULT_REST_SEC,
    exercises: [{ exerciseId, sets: targets }],
  }
}

export const initialTemplates: WorkoutTemplate[] = [
  {
    id: 'template-a',
    name: 'Treeni 1',
    blocks: [
      straight('a1', 'back-squat', 3, 10),
      straight('a2', 'dumbbell-bench-press', 3, 12),
      straight('a3', 'calf-raise', 3, 15),
      straight('a4', 'lat-pulldown', 3, 15),
      straight('a5', 'single-leg-press', 2, 10),
      straight('a6', 'triceps-pushdown', 3, 12),
    ],
  },
  {
    id: 'template-b',
    name: 'Treeni 2',
    blocks: [
      straight('b1', 'trap-bar-deadlift', 3, 15),
      straight('b2', 'machine-shoulder-press', 3, 10),
      straight('b3', 'seated-cable-row', 3, 12),
      straight('b4', 'hip-abductor', 3, 12),
      straight('b5', 'face-pull', 3, 12),
      straight('b6', 'cable-curl', 3, 10),
    ],
  },
]
