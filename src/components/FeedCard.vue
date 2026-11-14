<script setup lang="ts">
import { computed, ref } from 'vue'
import SportIcon from './SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { REACTIONS, myReaction, reactionNames, summarizeReactions, type FeedRow, type ReactionKey } from '@/lib/feed'
import { formatDistance, formatDurationShort, formatShortDate } from '@/lib/format'
import { localDate } from '@/lib/session'
import { useAuth } from '@/stores/auth'
import { useExercises } from '@/stores/exercises'
import { recordVars, sportVars, useSportColors } from '@/stores/sportColors'
import { SPORT_LABELS } from '@/types/workout'

const props = defineProps<{ row: FeedRow }>()
const emit = defineEmits<{ react: [key: ReactionKey] }>()

const auth = useAuth()
const exercises = useExercises()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor(props.row.sport), isDark.value))
const summary = computed(() => summarizeReactions(props.row.reactions, auth.userId ?? ''))
const mine = computed(() => myReaction(props.row.reactions, auth.userId ?? ''))
const picking = ref(false)
/** Reaktio, jonka antajat on avattu näkyviin. Katoaa, jos reaktio poistuu. */
const showing = ref<ReactionKey | null>(null)
const shown = computed(() => summary.value.find((item) => item.key === showing.value) ?? null)

const day = computed(() => {
  const today = new Date()
  if (props.row.date === localDate(today)) return 'Tänään'
  today.setDate(today.getDate() - 1)
  if (props.row.date === localDate(today)) return 'Eilen'
  return formatShortDate(props.row.date)
})

/** Liikekirjaston nimi omasta sovelluksesta, kaverin oma liike palvelimen antamalla nimellä. */
function nameOf(exerciseId: string, serverName: string | null) {
  return exercises.byId.get(exerciseId)?.name ?? serverName ?? 'Liike'
}

/** Kesto ja matka: pelkässä Strava-treenissä ne ovat otsikko, muissa otsikon alla. */
const metrics = computed(() =>
  [
    props.row.duration_sec ? formatDurationShort(props.row.duration_sec) : null,
    props.row.distance_m ? formatDistance(props.row.sport, props.row.distance_m) : null,
  ]
    .filter(Boolean)
    .join(' · '),
)

const kg = (value: number) => value.toLocaleString('fi-FI', { maximumFractionDigits: 2 })

function pick(key: ReactionKey) {
  picking.value = false
  emit('react', key)
}
</script>

<template>
  <article :style="vars" class="rounded-(--radius-card) bg-surface p-3.5">
    <div class="flex items-baseline justify-between gap-2">
      <h3 class="truncate text-[15px] font-semibold">{{ row.is_me ? 'Sinä' : row.name || 'Nimetön' }}</h3>
      <span class="flex-none text-[12px] text-ink-muted" data-numeric>{{ day }}</span>
    </div>

    <div class="mt-2 flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class="flex size-10 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)] [&_svg]:size-6"
      >
        <SportIcon :sport="row.sport" />
      </span>
      <p class="min-w-0">
        <!-- Strava-treenissä otsikko on lajin nimi, joten yläriville jää vain lähde. -->
        <span
          v-if="row.from_strava"
          class="inline-block rounded-full border border-current px-1.5 py-px text-[9.5px] font-bold tracking-[0.06em] text-[var(--sport-on)] uppercase"
        >
          Strava
        </span>
        <span v-else class="block text-[11px] font-bold tracking-[0.08em] text-[var(--sport-on)] uppercase">
          {{ SPORT_LABELS[row.sport] }}
        </span>
        <span class="block truncate text-base font-semibold tracking-[-0.01em]">
          {{ row.title ?? SPORT_LABELS[row.sport] }}
        </span>
        <span v-if="metrics" class="block text-[13px] text-ink-muted" data-numeric>{{ metrics }}</span>
      </p>
    </div>

    <!-- Ennätykset: ruusu on varattu vain näille. -->
    <ul v-if="row.records?.length" :style="recordVars(isDark)" class="mt-2.5 flex flex-col gap-1.5">
      <li
        v-for="record in row.records"
        :key="record.exerciseId"
        class="rounded-(--radius-chip) bg-[var(--record-surface)] px-2.5 py-1.5 text-[13px] font-semibold text-[var(--record-on)]"
      >
        Ennätys: {{ nameOf(record.exerciseId, record.name) }} <span data-numeric>{{ kg(record.weightKg) }} kg</span>
      </li>
    </ul>

    <ul v-if="row.exercises?.length" class="mt-2.5 flex flex-col gap-0.5 text-[13px] text-ink-muted" data-numeric>
      <li v-for="(exercise, index) in row.exercises" :key="index">
        <span class="text-ink">{{ nameOf(exercise.exerciseId, exercise.name) }}</span>
        · {{ exercise.sets }} {{ exercise.sets === 1 ? 'sarja' : 'sarjaa' }}<template v-if="exercise.bestKg">
          · {{ kg(exercise.bestKg) }} kg</template
        >
      </li>
    </ul>

    <div v-if="summary.length || !row.is_me" class="mt-3 flex flex-wrap items-center gap-1.5">
      <!-- Reaktion napautus näyttää, kuka reagoi. Oma reaktio annetaan Reagoi-valikosta. -->
      <button
        v-for="item in summary"
        :key="item.key"
        type="button"
        :aria-label="`${item.label}, ${item.count}. Näytä kuka reagoi`"
        :aria-expanded="showing === item.key"
        :aria-controls="`reagoijat-${row.workout_id}`"
        class="inline-flex min-h-9 items-center gap-1 rounded-full border bg-bg px-2.5 text-[13px] font-semibold"
        :class="item.mine ? 'border-ink' : 'border-line'"
        @click="showing = showing === item.key ? null : item.key"
      >
        <span aria-hidden="true">{{ item.emoji }}</span><span data-numeric>{{ item.count }}</span>
      </button>

      <button
        v-if="!row.is_me"
        type="button"
        :aria-expanded="picking"
        class="ml-auto min-h-9 rounded-full border border-line bg-bg px-3.5 text-[13px] font-semibold"
        @click="picking = !picking"
      >
        Reagoi
      </button>
    </div>

    <p
      v-if="shown"
      :id="`reagoijat-${row.workout_id}`"
      role="status"
      class="mt-2 rounded-(--radius-chip) bg-bg px-2.5 py-1.5 text-[13px]"
    >
      <span aria-hidden="true" class="mr-1">{{ shown.emoji }}</span><span class="sr-only">{{ shown.label }}: </span>{{ reactionNames(shown) }}
    </p>

    <div
      v-if="picking"
      role="group"
      aria-label="Valitse reaktio"
      class="mt-2 flex justify-between rounded-full border border-line bg-bg px-1.5 py-1"
    >
      <button
        v-for="reaction in REACTIONS"
        :key="reaction.key"
        type="button"
        :aria-label="reaction.label"
        :aria-pressed="mine === reaction.key"
        class="flex size-11 items-center justify-center rounded-full text-[22px]"
        :class="mine === reaction.key ? 'bg-surface' : ''"
        @click="pick(reaction.key)"
      >
        <span aria-hidden="true">{{ reaction.emoji }}</span>
      </button>
    </div>
  </article>
</template>
