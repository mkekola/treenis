import { supabase } from '@/lib/supabase'

export type NotifyType = 'friend_request' | 'friend_accepted' | 'reaction' | 'challenge_invite'

/**
 * Pyytää palvelinta ilmoittamaan toiminnosta, jonka käyttäjä juuri teki. Palvelin
 * tarkistaa toiminnon tietokannasta ennen lähetystä. Ilmoitus on lisä: virhe ei
 * estä itse toimintoa, joten sitä ei odoteta eikä näytetä.
 */
export function notify(type: NotifyType, id?: string) {
  supabase.functions.invoke('push', { body: { action: 'notify', type, id } }).catch(() => undefined)
}
