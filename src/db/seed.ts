import { db, plain } from '@/db'
import { initialTemplates } from '@/data/initialTemplates'

/**
 * Ensimmäisen käynnistyksen data. Pohjat ovat Marian oikeat ohjelmat, joten ne
 * tallennetaan aina. Esimerkkitreenit ovat keksittyjä, joten ne ladataan vain
 * kehityksessä: oikeaan historiaan ei kuulu feikkitreenejä.
 */
export async function seedIfEmpty() {
  if ((await db.templates.count()) === 0) {
    await db.templates.bulkPut(plain(initialTemplates))
  }

  if (import.meta.env.DEV && (await db.workouts.count()) === 0) {
    const { sampleWorkouts } = await import('@/data/sampleWorkouts')
    await db.workouts.bulkPut(plain(sampleWorkouts))
  }
}
