import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nextReaction, myReaction, type FeedRow, type ReactionKey } from '@/lib/feed'
import { localDate } from '@/lib/session'
import { notify } from '@/lib/notify'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'

/** Syöte näyttää kaksi viikkoa: tarpeeksi tsemppaukseen, ei loputonta vierittämistä. */
const FEED_DAYS = 14

/** Kaverien syöte ja reaktiot. Kuten kaverit, syöte tarvitsee verkon. */
export const useFeed = defineStore('feed', () => {
  const auth = useAuth()
  const rows = ref<FeedRow[]>([])
  const loaded = ref(false)

  async function load() {
    const since = new Date()
    since.setDate(since.getDate() - (FEED_DAYS - 1))
    const { data, error } = await supabase.rpc('friend_feed', { since: localDate(since) })
    if (error) throw error
    rows.value = (data ?? []) as FeedRow[]
    loaded.value = true
  }

  /**
   * Napautettu reaktio. Näytetään heti ja palautetaan, jos tallennus epäonnistuu,
   * jotta napautus tuntuu välittömältä myös hitaalla salin verkolla.
   */
  async function react(workoutId: string, tapped: ReactionKey) {
    const me = auth.userId
    const row = rows.value.find((r) => r.workout_id === workoutId)
    if (!me || !row) return
    const before = row.reactions
    const next = nextReaction(myReaction(before, me), tapped)
    const others = before.filter((r) => r.userId !== me)
    row.reactions = next ? [...others, { reaction: next, userId: me, name: auth.name }] : others
    const { error } = await supabase.rpc('react', { target_workout: workoutId, new_reaction: next })
    if (error) {
      row.reactions = before
      throw error
    }
    if (next) notify('reaction', workoutId)
  }

  return { rows, loaded, load, react }
})
