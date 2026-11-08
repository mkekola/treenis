import Dexie, { type Table } from 'dexie'
import type { ActiveSession } from '@/types/session'
import type { Workout, WorkoutTemplate } from '@/types/workout'

/** Käynnissä oleva treeni. Yksi rivi, koska treenejä ei tehdä kahta yhtä aikaa. */
export interface ActiveSessionRecord {
  id: 'current'
  session: ActiveSession
}

/**
 * Paikallinen tietokanta. Treenit kirjataan ensin tänne ja synkataan
 * Supabaseen myöhemmin, joten sovellus toimii salilla ilman verkkoa.
 */
class TreenisDb extends Dexie {
  workouts!: Table<Workout, string>
  templates!: Table<WorkoutTemplate, string>
  activeSession!: Table<ActiveSessionRecord, string>

  constructor() {
    super('treenis')
    this.version(1).stores({
      workouts: 'id, date, sport',
      templates: 'id, name',
    })
    // Versio 2 lisää vain käynnissä olevan treenin. Versio 1 pidetään mukana,
    // jotta jo luodut tietokannat päivittyvät eikä data katoa.
    this.version(2).stores({
      activeSession: 'id',
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
