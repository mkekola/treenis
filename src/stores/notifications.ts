import { defineStore } from 'pinia'
import { ref } from 'vue'
import { base64UrlToBytes } from '@/lib/push'
import { supabase } from '@/lib/supabase'

export interface NotificationSettings {
  friend_requests: boolean
  reactions: boolean
  challenges: boolean
  streak: boolean
}

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/**
 * Push-ilmoitukset tällä laitteella. Lupa ja tilaus ovat laitekohtaisia, asetukset
 * tilikohtaisia: sama valinta koskee kaikkia laitteita.
 */
export const useNotifications = defineStore('notifications', () => {
  const supported =
    !!VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  /** Onko tällä laitteella voimassa oleva tilaus. */
  const enabled = ref(false)
  const settings = ref<NotificationSettings | null>(null)

  async function subscription() {
    const registration = await navigator.serviceWorker.ready
    return registration.pushManager.getSubscription()
  }

  async function load() {
    if (!supported) return
    enabled.value = Notification.permission === 'granted' && !!(await subscription())
    const { data, error } = await supabase
      .from('notification_settings')
      .select('friend_requests, reactions, challenges, streak')
      .maybeSingle()
    if (error) throw error
    settings.value = data ?? { friend_requests: true, reactions: true, challenges: true, streak: true }
  }

  /** Kysyy luvan ja tallentaa laitteen ilmoitusosoitteen. Kutsutaan napin painalluksesta (iOS vaatii). */
  async function enable(): Promise<'enabled' | 'denied'> {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'
    const registration = await navigator.serviceWorker.ready
    const sub =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlToBytes(VAPID_PUBLIC_KEY as string),
      }))
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    })
    if (error) throw error
    // Asetusrivi luodaan oletuksilla (kaikki päällä), jos sitä ei vielä ole.
    await supabase.from('notification_settings').upsert({}, { onConflict: 'user_id', ignoreDuplicates: true })
    enabled.value = true
    return 'enabled'
  }

  async function disable() {
    const sub = await subscription()
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      await sub.unsubscribe()
    }
    enabled.value = false
  }

  /** Näytetään heti ja palautetaan, jos tallennus epäonnistuu. */
  async function save(next: NotificationSettings) {
    const before = settings.value
    settings.value = next
    const { error } = await supabase
      .from('notification_settings')
      .upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) {
      settings.value = before
      throw error
    }
  }

  return { supported, enabled, settings, load, enable, disable, save }
})
