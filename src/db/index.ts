import Dexie, { type Table } from 'dexie'
import type { Workout, WorkoutTemplate } from '@/types/workout'

/**
 * Paikallinen tietokanta. Treenit kirjataan ensin tänne ja synkataan
 * Supabaseen myöhemmin, joten sovellus toimii salilla ilman verkkoa.
 */
class TreenisDb extends Dexie {
  workouts!: Table<Workout, string>
  templates!: Table<WorkoutTemplate, string>

  constructor() {
    super('treenis')
    this.version(1).stores({
      workouts: 'id, date, sport',
      templates: 'id, name',
    })
  }
}

export const db = new TreenisDb()

/**
 * IndexedDB ei voi tallentaa Vuen reaktiivisia proxy-olioita, vaan heittää
 * DataCloneErrorin. Tallennettava data kopioidaan siksi tavalliseksi JSONiksi.
 */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
