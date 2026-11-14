import { defineStore } from 'pinia'
import { ref } from 'vue'
import { nextReaction, myReaction, type FeedRow, type ReactionKey } from '@/lib/feed'
import { localDate } from '@/lib/session'
import { notify } from '@/lib/notify'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useWorkouts } from '@/stores/workouts'

/** Syöte näyttää kaksi viikkoa: tarpeeksi tsemppaukseen, ei loputonta vierittämistä. */
const FEED_DAYS = 14

/** Kaverien syöte ja reaktiot. Kuten kaverit, syöte tarvitsee verkon. */
export const useFeed = defineStore('feed', () => {
  const auth = useAuth()
  const workouts = useWorkouts()
  const rows = ref<FeedRow[]>([])
  const loaded = ref(false)
  /** Juuri piilotettu oma treeni ja sen paikka syötteessä, jotta piilotuksen voi kumota. */
  const lastHidden = ref<{ row: FeedRow; index: number } | null>(null)

  async function load() {
    const since = new Date()
    since.setDate(since.getDate() - (FEED_DAYS - 1))
    const { data, error } = await supabase.rpc('friend_feed', { since: localDate(since) })
    if (error) throw error
    rows.value = (data ?? []) as FeedRow[]
    lastHidden.value = null
    loaded.value = true
  }

  /**
   * Piilotus tallentuu treeniin laitteella ja kulkee synkassa palvelimelle, joten
   * rivi poistuu syötteestä heti verkkoa odottamatta.
   */
  async function hide(workoutId: string): Promise<boolean> {
    const index = rows.value.findIndex((r) => r.workout_id === workoutId)
    if (index === -1 || !(await workouts.setHidden(workoutId, true))) return false
    const [row] = rows.value.splice(index, 1)
    lastHidden.value = { row, index }
    return true
  }

  async function undoHide() {
    const last = lastHidden.value
    if (!last) return
    lastHidden.value = null
    await workouts.setHidden(last.row.workout_id, false)
    rows.value.splice(last.index, 0, last.row)
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

  return { rows, loaded, lastHidden, load, react, hide, undoHide }
})
