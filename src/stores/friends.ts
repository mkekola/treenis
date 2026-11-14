import { defineStore } from 'pinia'
import { ref } from 'vue'
import { friendLists, type FriendLists, type FriendshipRow } from '@/lib/friends'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'

/** Tietokantafunktion request_friend vastaukset. */
export type RequestResult = 'requested' | 'accepted' | 'already_friends' | 'already_requested' | 'not_found' | 'self'

/**
 * Kaverit. Toisin kuin treenit, kaverit eivät toimi offline: ne ovat aina toisen
 * käyttäjän tietoja, joten ne haetaan palvelimelta joka kerta.
 */
export const useFriends = defineStore('friends', () => {
  const auth = useAuth()
  const lists = ref<FriendLists>({ friends: [], incoming: [], outgoing: [] })
  const myCode = ref<string | null>(null)
  const loaded = ref(false)

  async function load() {
    const me = auth.userId
    if (!me) return
    const [{ data: rows, error }, code] = await Promise.all([
      supabase.from('friendships').select('id, requester, addressee, status, created_at'),
      loadCode(),
    ])
    if (error) throw error
    const friendships = (rows ?? []) as FriendshipRow[]
    const others = friendships.map((row) => (row.requester === me ? row.addressee : row.requester))
    const names = new Map<string, string>()
    if (others.length) {
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', others)
      if (profileError) throw profileError
      for (const p of profiles ?? []) names.set(p.id, p.display_name)
    }
    lists.value = friendLists(friendships, names, me)
    myCode.value = code
    loaded.value = true
  }

  async function loadCode(regenerate = false): Promise<string> {
    const { data, error } = await supabase.rpc('my_friend_code', { regenerate })
    if (error) throw error
    return data as string
  }

  async function regenerateCode() {
    myCode.value = await loadCode(true)
  }

  async function request(code: string): Promise<RequestResult> {
    const { data, error } = await supabase.rpc('request_friend', { friend_code: code })
    if (error) throw error
    await load()
    return data as RequestResult
  }

  async function respond(friendshipId: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_friend_request', { request_id: friendshipId, accept })
    if (error) throw error
    await load()
  }

  async function remove(friendshipId: string) {
    const { error } = await supabase.rpc('remove_friend', { friendship_id: friendshipId })
    if (error) throw error
    await load()
  }

  return { lists, myCode, loaded, load, regenerateCode, request, respond, remove }
})
