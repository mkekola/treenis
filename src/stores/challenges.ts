import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ChallengeMetric, ChallengeRow } from '@/lib/challenges'
import { notify } from '@/lib/notify'
import { supabase } from '@/lib/supabase'

/** Haasteet. Kuten kaverit, haasteet tarvitsevat verkon: tulokset lasketaan palvelimella. */
export const useChallenges = defineStore('challenges', () => {
  const rows = ref<ChallengeRow[]>([])
  const loaded = ref(false)

  async function load() {
    const { data, error } = await supabase.rpc('my_challenges')
    if (error) throw error
    rows.value = (data ?? []) as ChallengeRow[]
    loaded.value = true
  }

  async function create(metric: ChallengeMetric, startsOn: string, endsOn: string, invitees: string[]) {
    const { data, error } = await supabase.rpc('create_challenge', {
      metric,
      starts_on: startsOn,
      ends_on: endsOn,
      invitees,
    })
    if (error) throw error
    notify('challenge_invite', data as string)
    await load()
  }

  async function respond(challengeId: string, accept: boolean) {
    const { error } = await supabase.rpc('respond_challenge', { target_challenge: challengeId, accept })
    if (error) throw error
    await load()
  }

  async function leave(challengeId: string) {
    const { error } = await supabase.rpc('leave_challenge', { target_challenge: challengeId })
    if (error) throw error
    await load()
  }

  return { rows, loaded, load, create, respond, leave }
})
