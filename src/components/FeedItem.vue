<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import FeedComments from './FeedComments.vue'
import SportIcon from './SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { REACTIONS, feedLines, myReaction, reactionNames, summarizeReactions, type FeedRow, type ReactionKey } from '@/lib/feed'
import { useAuth } from '@/stores/auth'
import { useExercises } from '@/stores/exercises'
import { recordVars, sportVars, useSportColors } from '@/stores/sportColors'

/**
 * Syötteen rivi: kiinni yhden rivin yhteenveto ja ennätykset, auki liikkeet, reagoijat,
 * kommentit ja omissa treeneissä piilotus. Reaktio annetaan rivin lopun +-napista.
 */
const props = defineProps<{
  row: FeedRow
  /** Kommentti-ilmoituksesta avattu treeni: rivi aukeaa ja vierii näkyviin. */
  focused?: boolean
}>()
const emit = defineEmits<{ react: [key: ReactionKey]; hide: [] }>()

const auth = useAuth()
const exercises = useExercises()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor(props.row.sport), isDark.value))
const lines = computed(() => feedLines(props.row))
const summary = computed(() => summarizeReactions(props.row.reactions, auth.userId ?? ''))
const mine = computed(() => myReaction(props.row.reactions, auth.userId ?? ''))

const commentCount = computed(() => props.row.comments?.length ?? 0)

const open = ref(false)
const picking = ref(false)
const rowEl = useTemplateRef<HTMLLIElement>('rowEl')
const detailsId = computed(() => `tiedot-${props.row.workout_id}`)

/** Liikekirjaston nimi omasta sovelluksesta, kaverin oma liike palvelimen antamalla nimellä. */
function nameOf(exerciseId: string, serverName: string | null) {
  return exercises.byId.get(exerciseId)?.name ?? serverName ?? 'Liike'
}

const kg = (value: number) => value.toLocaleString('fi-FI', { maximumFractionDigits: 2 })

watch(
  () => props.focused,
  async (focused) => {
    if (!focused) return
    open.value = true
    await nextTick()
    rowEl.value?.scrollIntoView({ block: 'center' })
  },
  { immediate: true },
)

function pick(key: ReactionKey) {
  picking.value = false
  emit('react', key)
}
</script>

<template>
  <li ref="rowEl" :style="vars" class="scroll-mt-4 border-t border-line py-2.5 first:border-t-0">
    <div class="flex items-center gap-2">
      <button
        type="button"
        :aria-expanded="open"
        :aria-controls="detailsId"
        class="flex min-w-0 flex-1 items-center gap-2.5 rounded-[6px] text-left"
        @click="open = !open"
      >
        <span
          aria-hidden="true"
          class="flex size-9 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)] [&_svg]:size-[21px]"
        >
          <SportIcon :sport="row.sport" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[15px]">
            <strong class="font-bold">{{ lines.who }}</strong> · {{ lines.what }}
          </span>
          <span v-if="lines.detail" class="block truncate text-[13px] text-ink-muted" data-numeric>{{ lines.detail }}</span>
        </span>
        <!-- Reaktiot tiiviisti. Kuka reagoi, näkyy avatussa rivissä. -->
        <span v-if="summary.length" class="flex flex-none items-center gap-1.5" data-numeric>
          <span v-for="item in summary" :key="item.key" class="inline-flex items-center gap-0.5 text-[14px]">
            <span aria-hidden="true">{{ item.emoji }}</span>
            <span class="text-[12px] font-semibold" :class="item.mine ? 'text-ink' : 'text-ink-muted'">{{ item.count }}</span>
            <span class="sr-only">{{ item.label }} {{ item.count }}</span>
          </span>
        </span>
        <span v-if="commentCount" class="inline-flex flex-none items-center gap-0.5 text-ink-muted" data-numeric>
          <svg
            class="size-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H10l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
          </svg>
          <span class="text-[12px] font-semibold">{{ commentCount }}</span>
          <span class="sr-only">{{ commentCount === 1 ? 'kommentti' : 'kommenttia' }}</span>
        </span>
      </button>

      <button
        v-if="!row.is_me"
        type="button"
        :aria-label="mine ? 'Vaihda reaktio' : 'Reagoi'"
        :aria-expanded="picking"
        class="flex size-9 flex-none items-center justify-center rounded-full bg-bg text-[20px] leading-none"
        @click="picking = !picking"
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>

    <!-- Ennätykset aina näkyvissä: syötteen kiinnostavin hetki. Ruusu on varattu vain näille. -->
    <ul v-if="row.records?.length" :style="recordVars(isDark)" class="mt-2 ml-[46px] flex flex-col gap-1">
      <li
        v-for="record in row.records"
        :key="record.exerciseId"
        class="self-start rounded-(--radius-chip) bg-[var(--record-surface)] px-2.5 py-1 text-[13px] font-semibold text-[var(--record-on)]"
      >
        Ennätys: {{ nameOf(record.exerciseId, record.name) }}
        <span v-if="record.weightKg !== null" data-numeric>{{ kg(record.weightKg) }} kg</span>
      </li>
    </ul>

    <div
      v-if="picking"
      role="group"
      aria-label="Valitse reaktio"
      class="mt-2 flex justify-between rounded-full bg-bg px-1.5 py-1"
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

    <div v-if="open" :id="detailsId" class="mt-2 ml-[46px] flex flex-col gap-2 text-[13px]">
      <ul v-if="row.exercises?.length" class="flex flex-col gap-0.5 text-ink-muted" data-numeric>
        <li v-for="(exercise, index) in row.exercises" :key="index">
          <span class="text-ink">{{ nameOf(exercise.exerciseId, exercise.name) }}</span>
          · {{ exercise.sets }} {{ exercise.sets === 1 ? 'sarja' : 'sarjaa' }}<template v-if="exercise.bestKg">
            · {{ kg(exercise.bestKg) }} kg</template
          >
        </li>
      </ul>

      <ul v-if="summary.length" class="flex flex-col gap-0.5">
        <li v-for="item in summary" :key="item.key">
          <span aria-hidden="true" class="mr-1">{{ item.emoji }}</span><span class="sr-only">{{ item.label }}: </span>{{ reactionNames(item) }}
        </li>
      </ul>

      <FeedComments :row="row" />

      <div v-if="row.is_me">
        <button
          type="button"
          class="min-h-11 w-full rounded-(--radius-button) border border-line bg-bg text-[15px] font-semibold"
          @click="emit('hide')"
        >
          Piilota kavereilta
        </button>
        <p class="mt-1.5 text-ink-muted">
          Treeni lasketaan yhä haasteisiin. Saat sen takaisin näkyviin päiväkirjasta treenin tiedoista.
        </p>
      </div>
    </div>
  </li>
</template>
