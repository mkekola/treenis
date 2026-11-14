<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  METRICS,
  challengeState,
  daysLeft,
  joinNames,
  lengthInDays,
  periodLabel,
  scoreLabel,
  standings,
  winners,
  type ChallengeRow,
} from '@/lib/challenges'
import { localDate } from '@/lib/session'
import { useAuth } from '@/stores/auth'

const props = defineProps<{ row: ChallengeRow }>()
const emit = defineEmits<{ respond: [accept: boolean]; leave: [] }>()

const auth = useAuth()
const today = localDate(new Date())

const metric = computed(() => METRICS.find((m) => m.key === props.row.metric)!)
const state = computed(() => challengeState(props.row, today))
const ranked = computed(() => standings(props.row.members))
const won = computed(() => winners(props.row.members))
const pending = computed(() => props.row.members.filter((m) => m.status === 'invited'))
const me = computed(() => auth.userId)
const nameOf = (userId: string, name: string) => (userId === me.value ? 'Sinä' : name || 'Nimetön')

/** Kahden kesken vastakkain, porukassa sijoituslista. */
const duel = computed(() => ranked.value.length === 2)
const left = computed(() => ranked.value.find((m) => m.userId === me.value) ?? ranked.value[0])
const right = computed(() => ranked.value.find((m) => m.userId !== left.value?.userId))
const leftShare = computed(() => {
  const total = (left.value?.score ?? 0) + (right.value?.score ?? 0)
  return total ? Math.round(((left.value?.score ?? 0) / total) * 100) : 50
})
const best = computed(() => Math.max(1, ...ranked.value.map((m) => m.score)))

const inviter = computed(() => props.row.members.find((m) => m.userId === props.row.creator))

const meta = computed(() => {
  const period = periodLabel(props.row.starts_on, props.row.ends_on)
  if (state.value === 'upcoming') return `Alkaa ${period}`
  if (state.value === 'finished') return `Päättyi · ${period}`
  const remaining = daysLeft(props.row.ends_on, today)
  return `${period} · ${remaining === 1 ? 'viimeinen päivä' : `${remaining} päivää jäljellä`}`
})

const winnerText = computed(() => {
  if (!won.value.length) return 'Ei voittajaa tällä kertaa'
  if (won.value.length > 1) return `Tasapeli: ${won.value.map((w) => nameOf(w.userId, w.name)).join(' ja ')}`
  const w = won.value[0]
  return w.userId === me.value ? 'Sinä voitit!' : `${w.name || 'Nimetön'} voitti`
})

/** Oma saavutus: tulos verrattuna edelliseen yhtä pitkään jaksoon. */
const myResult = computed(() => {
  const mine = ranked.value.find((m) => m.userId === me.value)
  if (!mine) return null
  const prev = props.row.previous_score
  const result = scoreLabel(props.row.metric, mine.score)
  if (prev === null) return result
  if (mine.score > prev) return `${result}, enemmän kuin edellisellä vastaavalla jaksolla (${prev}).`
  return `${result}. Edellisellä vastaavalla jaksolla ${prev}.`
})

/** Uusintaottelu samoilla kavereilla, mittarilla ja pituudella. */
const rematch = computed(() => ({
  path: '/kaverit/haaste',
  query: {
    mittari: props.row.metric,
    kaverit: props.row.members.filter((m) => m.userId !== me.value).map((m) => m.userId).join(','),
    paivia: String(lengthInDays(props.row.starts_on, props.row.ends_on)),
  },
}))

const confirmingLeave = ref(false)
</script>

<template>
  <article class="rounded-(--radius-card) bg-surface p-3.5">
    <h3 class="font-display text-[19px] leading-tight font-bold tracking-[-0.01em]">{{ metric.title }}</h3>
    <p class="mt-0.5 text-[13px] text-ink-muted" data-numeric>{{ meta }}</p>

    <!-- Kutsu: vastaus ensin, tulokset vasta mukaan lähtiessä. -->
    <template v-if="row.my_status === 'invited'">
      <p class="mt-2 text-[15px]">{{ inviter?.name || 'Kaveri' }} haastoi sinut.</p>
      <p class="mt-1 text-[13px] text-ink-muted">
        Lasketaan: {{ metric.label.toLowerCase() }} ({{ metric.hint.charAt(0).toLowerCase() + metric.hint.slice(1) }}).
        Mukana {{ joinNames(row.members.map((m) => nameOf(m.userId, m.name))) }}.
      </p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
          @click="emit('respond', false)"
        >
          Hylkää
        </button>
        <button
          type="button"
          class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action"
          @click="emit('respond', true)"
        >
          Lähde mukaan
        </button>
      </div>
    </template>

    <template v-else>
      <!-- Päättynyt: voittaja toimintovärillä, ei uutta väriä (ruusu on ennätysten). -->
      <div v-if="state === 'finished'" class="mt-3 rounded-(--radius-field) bg-action p-3.5 text-on-action">
        <p class="font-display text-[24px] leading-tight font-bold">
          <span v-if="won.length" aria-hidden="true">🏆 </span>{{ winnerText }}
        </p>
      </div>

      <div v-if="duel && left && right" class="mt-3" data-numeric>
        <div class="flex items-end justify-between">
          <div>
            <p class="font-display text-[40px] leading-none font-bold">{{ left.score }}</p>
            <p class="mt-1 text-[13px] font-semibold text-ink-muted">{{ nameOf(left.userId, left.name) }}</p>
          </div>
          <div class="text-right">
            <p class="font-display text-[40px] leading-none font-bold">{{ right.score }}</p>
            <p class="mt-1 text-[13px] font-semibold text-ink-muted">{{ nameOf(right.userId, right.name) }}</p>
          </div>
        </div>
        <div
          class="mt-2.5 h-3 overflow-hidden rounded-[4px] bg-track"
          role="img"
          :aria-label="`${nameOf(left.userId, left.name)} ${left.score}, ${nameOf(right.userId, right.name)} ${right.score}`"
        >
          <div class="h-full rounded-[4px] bg-[var(--c-data)]" :style="{ width: `${leftShare}%` }" />
        </div>
      </div>

      <ol v-else-if="ranked.length" class="mt-2" data-numeric>
        <li
          v-for="person in ranked"
          :key="person.userId"
          class="grid grid-cols-[20px_minmax(0,1fr)_64px_28px] items-center gap-2 border-t border-line py-2 text-[15px] first:border-t-0"
        >
          <span class="font-semibold text-ink-muted">{{ person.rank }}</span>
          <span class="truncate" :class="person.userId === me ? 'font-bold' : ''">{{ nameOf(person.userId, person.name) }}</span>
          <span class="h-2.5 overflow-hidden rounded-[4px] bg-track" aria-hidden="true">
            <span class="block h-full rounded-[4px] bg-[var(--c-data)]" :style="{ width: `${(person.score / best) * 100}%` }" />
          </span>
          <span class="text-right font-bold">{{ person.score }}</span>
        </li>
      </ol>

      <p v-if="pending.length" class="mt-2 text-[13px] text-ink-muted">
        Odottaa vastausta: {{ pending.map((m) => m.name || 'Nimetön').join(', ') }}
      </p>

      <p v-if="state === 'finished' && myResult" class="mt-3 rounded-(--radius-chip) bg-bg p-2.5 text-[13.5px]">
        <strong class="font-semibold">Sinun tuloksesi:</strong> {{ myResult }}
      </p>

      <RouterLink
        v-if="state === 'finished'"
        :to="rematch"
        class="mt-3 flex min-h-11 items-center justify-center rounded-(--radius-button) border border-line font-semibold"
      >
        Uusintaottelu
      </RouterLink>

      <template v-else>
        <div v-if="confirmingLeave" class="mt-3">
          <p class="text-[13px]">Poistutaanko haasteesta? Tuloksesi poistuu muilta.</p>
          <div class="mt-2 flex gap-2">
            <button
              type="button"
              class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
              @click="confirmingLeave = false"
            >
              Peruuta
            </button>
            <button
              type="button"
              class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action"
              @click="emit('leave')"
            >
              Poistu
            </button>
          </div>
        </div>
        <button
          v-else
          type="button"
          class="mt-1 min-h-11 text-sm font-semibold text-ink-muted underline"
          @click="confirmingLeave = true"
        >
          Poistu haasteesta
        </button>
      </template>
    </template>
  </article>
</template>
