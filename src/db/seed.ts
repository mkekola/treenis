import { db, plain } from '@/db'
import { initialTemplates } from '@/data/initialTemplates'
import { DEFAULT_PROGRAM_ID, DEFAULT_PROGRAM_NAME } from '@/lib/program'

/**
 * Ensimmäisen käynnistyksen data. Pohjat ovat Marian oikeat treenit, joten ne
 * tallennetaan aina omaan ohjelmaansa. Esimerkkitreenit ovat keksittyjä, joten
 * ne ladataan vain kehityksessä: oikeaan historiaan ei kuulu feikkitreenejä.
 *
 * Seed ei mene lähetysjonoon. Jos palvelimella on jo dataa, synkka korvaa
 * nämä sillä, koska palvelimen versioilla on aikaleima ja näillä ei.
 */
export async function seedIfEmpty() {
  if ((await db.templates.count()) === 0) {
    await db.templates.bulkPut(plain(initialTemplates))
  }

  if ((await db.programs.count()) === 0) {
    await db.programs.put({
      id: DEFAULT_PROGRAM_ID,
      name: DEFAULT_PROGRAM_NAME,
      templateIds: initialTemplates.map((t) => t.id),
      activatedAt: new Date().toISOString(),
    })
  }

  if (import.meta.env.DEV && (await db.workouts.count()) === 0) {
    const { sampleWorkouts } = await import('@/data/sampleWorkouts')
    await db.workouts.bulkPut(plain(sampleWorkouts))
  }
}
