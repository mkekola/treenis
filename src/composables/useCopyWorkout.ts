import { useRouter } from 'vue-router'
import { useSession } from '@/stores/session'
import type { Workout } from '@/types/workout'

/**
 * Kopioi uudeksi: salitreeni aloitetaan samoilla liikkeillä, sarjoilla ja
 * painoilla, ja päivän ja keston voi korjata yhteenvedossa. Muut lajit avaavat
 * lomakkeen valmiiksi täytettynä.
 */
export function useCopyWorkout() {
  const router = useRouter()
  const session = useSession()

  return async function copy(workout: Workout) {
    if (workout.sport === 'strength') {
      await session.startFrom(workout)
      await router.push('/treeni')
      return
    }
    await router.push({ path: `/kirjaa/${workout.sport}`, query: { kopio: workout.id } })
  }
}
