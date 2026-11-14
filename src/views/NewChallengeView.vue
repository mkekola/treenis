<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { METRICS, lengthInDays, periodLabel, presetPeriod, type ChallengeMetric } from '@/lib/challenges'
import { localDate } from '@/lib/session'
import { useChallenges } from '@/stores/challenges'
import { useFriends } from '@/stores/friends'

const friends = useFriends()
const challenges = useChallenges()
const route = useRoute()
const router = useRouter()

const message = ref('')
const busy = ref(false)

onMounted(async () => {
  if (friends.loaded) return
  try {
    await friends.load()
  } catch {
    message.value = 'Haasteet tarvitsevat verkkoyhteyden.'
  }
})

// Uusintaottelu tuo kaverit, mittarin ja pituuden valmiiksi.
const query = route.query
const selected = ref<string[]>(typeof query.kaverit === 'string' ? query.kaverit.split(',').filter(Boolean) : [])
const metric = ref<ChallengeMetric>(
  METRICS.some((m) => m.key === query.mittari) ? (query.mittari as ChallengeMetric) : 'strength',
)
const rematchDays = Number(query.paivia) || 0
const duration = ref<'week' | 'month' | 'custom'>(
  rematchDays && rematchDays !== 7 && rematchDays !== 30 ? 'custom' : rematchDays === 7 ? 'week' : 'month',
)

const today = new Date()
const customStart = ref(localDate(today))
const customEnd = ref(
  (() => {
    const end = new Date(today)
    end.setDate(end.getDate() + Math.max(rematchDays, 14) - 1)
    return localDate(end)
  })(),
)

const period = computed(() =>
  duration.value === 'custom'
    ? { startsOn: customStart.value, endsOn: customEnd.value }
    : presetPeriod(duration.value, today),
)
const periodError = computed(() => {
  const { startsOn, endsOn } = period.value
  if (!startsOn || !endsOn || endsOn < startsOn) return 'Loppupäivä ei voi olla ennen alkua.'
  if (startsOn < localDate(today)) return 'Haaste ei voi alkaa menneisyydessä.'
  if (lengthInDays(startsOn, endsOn) > 93) return 'Haaste voi kestää enintään kolme kuukautta.'
  return ''
})

function toggle(userId: string) {
  selected.value = selected.value.includes(userId)
    ? selected.value.filter((id) => id !== userId)
    : [...selected.value, userId]
}

const canSend = computed(() => selected.value.length > 0 && !periodError.value && !busy.value)

async function send() {
  busy.value = true
  message.value = ''
  try {
    await challenges.create(metric.value, period.value.startsOn, period.value.endsOn, selected.value)
    await router.push('/kaverit')
  } catch {
    message.value = 'Haaste ei lähtenyt. Tarkista verkkoyhteys.'
  } finally {
    busy.value = false
  }
}

const DURATIONS = [
  { key: 'week', label: 'Viikko' },
  { key: 'month', label: 'Kuukausi' },
  { key: 'custom', label: 'Oma' },
] as const
</script>

<template>
  <div class="flex flex-col gap-4 px-5 pt-6 pb-6">
    <RouterLink
      to="/kaverit"
      aria-label="Peru ja palaa kavereihin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Uusi haaste</h1>

    <form class="flex flex-col gap-4" @submit.prevent="send">
      <fieldset>
        <legend class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Kenen kanssa</legend>
        <p v-if="friends.loaded && !friends.lists.friends.length" class="mt-2 text-[15px] text-ink-muted">
          Lisää ensin kavereita, niin voit haastaa heidät.
        </p>
        <div class="mt-2.5 flex flex-wrap gap-2">
          <button
            v-for="friend in friends.lists.friends"
            :key="friend.userId"
            type="button"
            :aria-pressed="selected.includes(friend.userId)"
            class="min-h-11 rounded-(--radius-button) border px-4 font-semibold"
            :class="selected.includes(friend.userId) ? 'border-action bg-action text-on-action' : 'border-line bg-bg'"
            @click="toggle(friend.userId)"
          >
            {{ friend.name }}
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Mitä mitataan</legend>
        <div class="mt-2.5 rounded-(--radius-feature) bg-surface px-4 py-1">
          <label
            v-for="option in METRICS"
            :key="option.key"
            class="flex min-h-14 items-center gap-3 border-t border-line py-2 first:border-t-0"
          >
            <span class="min-w-0 flex-1">
              <span class="block text-[15px]">{{ option.label }}</span>
              <span class="block text-[13px] text-ink-muted">{{ option.hint }}</span>
            </span>
            <input v-model="metric" type="radio" name="mittari" :value="option.key" class="size-5 accent-[var(--c-action)]" />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Kesto</legend>
        <div class="mt-2.5 grid grid-cols-3 gap-1 rounded-(--radius-button) bg-surface p-1">
          <label
            v-for="option in DURATIONS"
            :key="option.key"
            class="flex min-h-10 cursor-pointer items-center justify-center rounded-(--radius-button) text-sm font-semibold has-[:checked]:bg-bg has-[:checked]:text-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
            :class="duration === option.key ? '' : 'text-ink-muted'"
          >
            <input v-model="duration" type="radio" name="kesto" :value="option.key" class="sr-only" />
            {{ option.label }}
          </label>
        </div>
        <div v-if="duration === 'custom'" class="mt-2.5 grid grid-cols-2 gap-2">
          <label class="text-[13px] text-ink-muted">
            Alkaa
            <input v-model="customStart" type="date" class="mt-1 block h-11 w-full rounded-(--radius-field) border border-line bg-bg px-3 text-base text-ink" />
          </label>
          <label class="text-[13px] text-ink-muted">
            Päättyy
            <input v-model="customEnd" type="date" class="mt-1 block h-11 w-full rounded-(--radius-field) border border-line bg-bg px-3 text-base text-ink" />
          </label>
        </div>
        <p class="mt-2 text-[13px]" :class="periodError ? 'font-semibold' : 'text-ink-muted'" data-numeric>
          {{ periodError || periodLabel(period.startsOn, period.endsOn) }}
        </p>
      </fieldset>

      <button
        type="submit"
        :disabled="!canSend"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-40"
      >
        {{ busy ? 'Lähetetään…' : 'Lähetä haaste' }}
      </button>
      <p v-if="message" role="status" class="text-[13px] font-semibold">{{ message }}</p>
    </form>
  </div>
</template>
