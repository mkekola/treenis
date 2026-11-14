import { db, plain } from '@/db'
import { initialTemplates } from '@/data/initialTemplates'
import { DEFAULT_PROGRAM_ID, DEFAULT_PROGRAM_NAME } from '@/lib/program'

/**
 * Kehitysversion esimerkkidata. Pohjat ovat Marian oikeat treenit ja esimerkkitreenit
 * keksittyjä, joten kumpaakaan ei luoda tuotannossa: jokainen käyttäjä aloittaa
 * tyhjästä ja tekee omat ohjelmansa, eikä oikeaan historiaan kuulu feikkitreenejä.
 */
export async function seedIfEmpty() {
  if (!import.meta.env.DEV) return

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

  if ((await db.workouts.count()) === 0) {
    const { sampleWorkouts } = await import('@/data/sampleWorkouts')
    await db.workouts.bulkPut(plain(sampleWorkouts))
  }
}
