import { onBeforeUnmount, onMounted } from 'vue'
import { nextSetLabel } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useExercises } from '@/stores/exercises'
import { useSession } from '@/stores/session'

/** Ajastusta ei kannata tehdä, jos lepoa on jäljellä vain hetki: ilmoitus tulisi joka tapauksessa myöhässä. */
const MIN_AHEAD_MS = 3000

/**
 * Levon päättymisilmoitus, kun käyttäjä on treenin aikana toisessa sovelluksessa.
 * Taustalle siirtyessä ajastus tallennetaan palvelimelle, joka lähettää ilmoituksen
 * levon päättyessä. Palatessa ajastus poistetaan, koska sovelluksen oma äänimerkki
 * hoitaa silloin asian. Toimii koko sovelluksessa, ei vain treeninäkymässä.
 */
export function useRestAlarm() {
  const auth = useAuth()
  const session = useSession()
  const exercises = useExercises()

  const allowed = () => 'Notification' in window && Notification.permission === 'granted'

  async function schedule() {
    const active = session.active
    const endsAt = active?.restEndsAt
    if (!active || !endsAt || !auth.userId || !allowed()) return
    if (Date.parse(endsAt) - Date.now() < MIN_AHEAD_MS) return
    const next = nextSetLabel(active, (id) => exercises.byId.get(id)?.name ?? 'Seuraava liike')
    await supabase.from('rest_alarms').upsert({
      user_id: auth.userId,
      fires_at: endsAt,
      body: next ? `Seuraavaksi: ${next}`.slice(0, 200) : 'Seuraava sarja odottaa.',
    })
  }

  async function cancel() {
    if (!auth.userId) return
    await supabase.from('rest_alarms').delete().eq('user_id', auth.userId)
  }

  // Verkkovirhe ei saa näkyä käyttäjälle: pahimmillaan ilmoitus jää tulematta tai tulee turhaan.
  function onVisibility() {
    void (document.visibilityState === 'hidden' ? schedule() : cancel()).catch(() => {})
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisibility))
}
