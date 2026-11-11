import Dexie, { type Table } from 'dexie'
import type { ActiveSession } from '@/types/session'
import { DEFAULT_PROGRAM_ID, DEFAULT_PROGRAM_NAME } from '@/lib/program'
import type { Exercise, Program, Workout, WorkoutTemplate } from '@/types/workout'

/** Käynnissä oleva treeni. Yksi rivi, koska treenejä ei tehdä kahta yhtä aikaa. */
export interface ActiveSessionRecord {
  id: 'current'
  session: ActiveSession
}

export type SyncKind = 'workout' | 'template' | 'exercise' | 'program'

/**
 * Laitteella muuttunut rivi, jota ei ole vielä lähetetty Supabaseen.
 * Tunnisteet eivät mene ristiin: treenit ovat UUID:ita, pohjat "template-…",
 * omat liikkeet "custom-…" ja ohjelmat "program-…".
 */
export interface OutboxRecord {
  id: string
  kind: SyncKind
  /** Lähetetty versio. Jos rivi muuttuu lähetyksen aikana, merkintä jää jonoon. */
  updatedAt: string
}

// Oikeiden treenien tunnisteet ovat UUID:ita. Kehityksen esimerkkitreeneillä on
// lyhyet tunnisteet (w1, w2 …), eikä niitä lähetetä palvelimelle.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Omat liikkeet olivat ennen versiota 3 localStoragessa.
const LEGACY_EXERCISES_KEY = 'treenis.customExercises'

function readLegacyExercises(): Exercise[] {
  try {
    const raw = localStorage.getItem(LEGACY_EXERCISES_KEY)
    return raw ? (JSON.parse(raw) as Exercise[]) : []
  } catch {
    return []
  }
}

/**
 * Paikallinen tietokanta. Treenit kirjataan ensin tänne ja synkataan
 * Supabaseen myöhemmin, joten sovellus toimii salilla ilman verkkoa.
 */
class TreenisDb extends Dexie {
  workouts!: Table<Workout, string>
  templates!: Table<WorkoutTemplate, string>
  customExercises!: Table<Exercise, string>
  programs!: Table<Program, string>
  activeSession!: Table<ActiveSessionRecord, string>
  outbox!: Table<OutboxRecord, string>

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
    // Versio 3 lisää lähetysjonon ja siirtää omat liikkeet tänne. Laitteella
    // jo oleva data laitetaan jonoon, jotta se lähtee Supabaseen ensimmäisellä
    // kirjautumisella.
    this.version(3)
      .stores({ outbox: 'id', customExercises: 'id' })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const outbox = tx.table<OutboxRecord, string>('outbox')

        const workouts = tx.table<Workout, string>('workouts')
        await workouts.toCollection().modify((w) => {
          w.updatedAt ??= now
        })
        const real = (await workouts.toArray()).filter((w) => UUID.test(w.id))
        await outbox.bulkPut(real.map((w) => ({ id: w.id, kind: 'workout', updatedAt: now })))

        const templates = tx.table<WorkoutTemplate, string>('templates')
        await templates.toCollection().modify((t) => {
          t.updatedAt ??= now
        })
        const allTemplates = await templates.toArray()
        await outbox.bulkPut(allTemplates.map((t) => ({ id: t.id, kind: 'template', updatedAt: now })))

        const exercises = readLegacyExercises().map((e) => ({ ...e, updatedAt: now }))
        await tx.table<Exercise, string>('customExercises').bulkPut(exercises)
        await outbox.bulkPut(exercises.map((e) => ({ id: e.id, kind: 'exercise', updatedAt: now })))
      })
    // Versio 4 lisää ohjelmat. Laitteella jo olevat pohjat kootaan Marian
    // nykyiseen ohjelmaan, joka otetaan käyttöön.
    this.version(4)
      .stores({ programs: 'id' })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const table = tx.table<WorkoutTemplate, string>('templates')
        const outbox = tx.table<OutboxRecord, string>('outbox')

        // Treenit nimettiin numeroilla kirjainten sijaan. Itse annettuihin nimiin ei kosketa.
        const renamed: Record<string, string> = { 'Treeni A': 'Treeni 1', 'Treeni B': 'Treeni 2' }
        for (const template of await table.toArray()) {
          const name = renamed[template.name]
          if (!name) continue
          await table.put({ ...template, name, updatedAt: now })
          await outbox.put({ id: template.id, kind: 'template', updatedAt: now })
        }

        const templates = (await table.toArray()).filter((t) => !t.deletedAt)
        if (!templates.length) return
        const program: Program = {
          id: DEFAULT_PROGRAM_ID,
          name: DEFAULT_PROGRAM_NAME,
          templateIds: templates.map((t) => t.id),
          activatedAt: now,
          updatedAt: now,
        }
        await tx.table<Program, string>('programs').put(program)
        await outbox.put({ id: program.id, kind: 'program', updatedAt: now })
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
