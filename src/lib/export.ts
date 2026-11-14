import { avgHr, distanceM, durationSec, isFromStrava } from '@/lib/workout'
import { FEEL_LABELS, SPORT_LABELS, type Exercise, type Program, type Workout, type WorkoutTemplate } from '@/types/workout'

export interface ExportData {
  workouts: Workout[]
  templates: WorkoutTemplate[]
  programs: Program[]
  customExercises: Exercise[]
}

/**
 * Kaikki omat tiedot yhtenä JSON-tiedostona: varmuuskopio, josta mitään ei puutu.
 * version kertoo muodon, jos tiedostoa joskus tuodaan takaisin.
 */
export function exportJson(data: ExportData, exportedAt: Date): string {
  return JSON.stringify(
    {
      app: 'Treenis',
      version: 1,
      exportedAt: exportedAt.toISOString(),
      workouts: [...data.workouts].sort((a, b) => a.date.localeCompare(b.date)),
      programs: data.programs,
      templates: data.templates,
      customExercises: data.customExercises,
    },
    null,
    2,
  )
}

const COLUMNS = [
  'Päivä',
  'Laji',
  'Treeni',
  'Lähde',
  'Kesto (min)',
  'Matka (km)',
  'Keskisyke',
  'Rasitus',
  'Liike',
  'Sarja',
  'Toistot',
  'Paino (kg)',
  'Aika (s)',
  'Tehty',
  'Tuntuma',
  'Muistiinpano',
]

type Value = string | number | undefined

/** Suomalainen Excel ja Numbers: puolipiste erottimena ja desimaalipilkku. */
function cell(value: Value): string {
  if (value === undefined) return ''
  const text = typeof value === 'number' ? String(value).replace('.', ',') : value
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const round = (value: number, decimals: number) => Math.round(value * 10 ** decimals) / 10 ** decimals

function source(w: Workout): string {
  if (w.logged && w.measured) return 'Treenis ja Strava'
  return isFromStrava(w) ? 'Strava' : 'Treenis'
}

/**
 * Treenit taulukkona: salitreenissä yksi rivi per sarja, muissa yksi rivi per treeni.
 * Kesto, matka ja syke samoilla säännöillä kuin sovelluksessa: mitattu voittaa kirjatun.
 */
export function workoutsCsv(workouts: Workout[], nameOf: (exerciseId: string) => string): string {
  const rows: Value[][] = []
  for (const w of [...workouts].sort((a, b) => a.date.localeCompare(b.date))) {
    const seconds = durationSec(w)
    const meters = distanceM(w)
    const workout: Value[] = [
      w.date,
      SPORT_LABELS[w.sport],
      w.title,
      source(w),
      seconds ? round(seconds / 60, 1) : undefined,
      meters ? round(meters / 1000, 2) : undefined,
      avgHr(w),
      w.logged?.rpe,
    ]
    const notes = w.logged?.notes

    const exercises = (w.logged?.blocks ?? []).flatMap((block) => block.exercises)
    if (!exercises.length) {
      rows.push([...workout, undefined, undefined, undefined, undefined, undefined, undefined, undefined, notes])
      continue
    }
    for (const exercise of exercises) {
      exercise.sets.forEach((set, index) => {
        rows.push([
          ...workout,
          nameOf(exercise.exerciseId),
          index + 1,
          set.reps,
          set.weightKg,
          set.durationSec,
          set.done ? 'kyllä' : 'ei',
          exercise.feel ? FEEL_LABELS[exercise.feel] : undefined,
          notes,
        ])
      })
    }
  }
  const lines = [COLUMNS, ...rows].map((row) => row.map(cell).join(';'))
  // BOM, jotta Excel tunnistaa ä- ja ö-kirjaimet.
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}
