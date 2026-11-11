<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { canComplete } from '@/lib/session'
import type { PreviousResult, WeightHint } from '@/types/session'
import { FEEL_LABELS, type Measurement, type SetEntry } from '@/types/workout'

export interface SetValues {
  weightKg?: number
  reps?: number
  durationSec?: number
}

const props = defineProps<{
  set: SetEntry
  index: number
  state: 'done' | 'current' | 'upcoming'
  measurement: Measurement
  hint?: WeightHint
  previous?: PreviousResult
}>()

const emit = defineEmits<{ complete: []; undo: []; edit: [values: SetValues] }>()

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })
const kg = (value: number) => kgFormat.format(value)

/** "62,5 kg × 12", "× 12" kun painoa ei ole vielä kirjattu. */
const label = computed(() => {
  const { weightKg, reps, durationSec } = props.set
  if (props.measurement === 'time') return `${durationSec ?? 0} s`
  if (props.measurement === 'reps') return `${reps ?? 0} toistoa`
  return `${weightKg ? `${kg(weightKg)} kg` : '—'} × ${reps ?? 0}`
})

const ready = computed(() => canComplete(props.set, props.measurement))

/**
 * Ensimmäinen kerta: paino puuttuu, joten sitä kysytään kentällä. Kenttä
 * tallentaa jo kirjoittaessa, jotta ruksi aktivoituu heti, mutta silloin
 * paino ei enää puutu. Siksi kenttä pidetään auki koko sen ajan kun sarja on
 * vuorossa, eikä näkymä vaihdu kesken kirjoituksen ("62,5" menisi muuten
 * rikki ensimmäiseen numeroon).
 */
const prompting = ref(false)
watch(
  () => [props.state, props.set.weightKg, props.measurement] as const,
  ([state, weight, measurement]) => {
    if (state !== 'current') prompting.value = false
    else if (measurement === 'weight_reps' && !weight) prompting.value = true
  },
  { immediate: true },
)

/** Merkintä näytetään vain kun rivin paino on edelleen ehdotettu paino. */
const hintLabel = computed(() => {
  const { hint, set } = props
  if (!hint || set.weightKg !== hint.toKg) return null
  const delta = hint.toKg - hint.fromKg
  return `${delta > 0 ? '↑ +' : '↓ −'}${kg(Math.abs(delta))} kg`
})

const previousLabel = computed(() => {
  const { previous } = props
  if (!previous) return null
  const feel = previous.feel ? `, tuntui: ${FEEL_LABELS[previous.feel].toLowerCase()}` : ''
  return `viimeksi ${kg(previous.weightKg)} kg${feel}`
})

// --- muokkaus ---

const editing = ref(false)
const weightText = ref('')
const repsText = ref('')
const secondsText = ref('')

function parse(text: string): number | undefined {
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : undefined
}

function startEdit() {
  weightText.value = props.set.weightKg ? String(props.set.weightKg).replace('.', ',') : ''
  repsText.value = props.set.reps ? String(props.set.reps) : ''
  secondsText.value = props.set.durationSec ? String(props.set.durationSec) : ''
  editing.value = true
}

function applyEdit() {
  emit('edit', {
    weightKg: parse(weightText.value),
    reps: parse(repsText.value),
    durationSec: parse(secondsText.value),
  })
  editing.value = false
}

/** Ensimmäisen kerran painokenttä tallentaa jo kirjoittaessa, jotta merkintä aktivoituu heti. */
function onWeightInput(event: Event) {
  const value = parse((event.target as HTMLInputElement).value)
  if (value !== undefined) emit('edit', { weightKg: value })
}

const rowId = useId()
</script>

<template>
  <!-- Tehty -->
  <div
    v-if="state === 'done'"
    class="flex items-center gap-2.5 rounded-(--radius-field) bg-surface py-2 pr-2 pl-3"
  >
    <span
      aria-hidden="true"
      class="flex size-6 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sport-on)_14%,transparent)] text-xs font-bold text-[var(--sport-on)]"
    >
      {{ index + 1 }}
    </span>
    <span class="min-w-0 flex-1 text-[17px] font-semibold" data-numeric>{{ label }}</span>
    <button
      type="button"
      class="flex size-12 flex-none items-center justify-center rounded-xl bg-action text-on-action"
      :aria-label="`Kumoa sarja ${index + 1}`"
      @click="emit('undo')"
    >
      <svg class="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="5,13 10,18 19,7" />
      </svg>
    </button>
  </div>

  <!-- Vuorossa, ensimmäinen kerta: paino puuttuu -->
  <div
    v-else-if="prompting"
    class="rounded-(--radius-field) border-2 border-[var(--sport-on)] bg-surface p-2 pl-2.5"
  >
    <div class="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class="flex size-6 flex-none items-center justify-center rounded-full bg-[var(--sport-on)] text-xs font-bold text-[var(--sport-surface)]"
      >
        {{ index + 1 }}
      </span>
      <span class="flex min-w-0 flex-1 items-end gap-2">
        <span class="min-w-0 flex-1">
          <label
            :for="rowId"
            class="block text-[11px] font-bold tracking-[0.06em] text-[var(--sport-on)] uppercase"
          >
            Paino, kg
          </label>
          <input
            :id="rowId"
            type="text"
            inputmode="decimal"
            placeholder="Kirjaa"
            class="mt-0.5 h-12 w-full min-w-0 rounded-xl border-2 border-dashed border-[var(--sport-on)] bg-bg px-3 text-[22px] font-bold tracking-[-0.01em]"
            data-numeric
            @input="onWeightInput"
          />
        </span>
        <span class="pb-3 text-[21px] font-bold whitespace-nowrap" data-numeric>
          × {{ set.reps ?? 0 }}
        </span>
      </span>
      <button
        type="button"
        class="mt-[18px] flex size-12 flex-none items-center justify-center rounded-xl border-2 border-ink bg-transparent text-ink active:bg-action active:text-on-action disabled:opacity-40"
        :disabled="!ready"
        :aria-label="`Merkitse sarja ${index + 1} tehdyksi${ready ? '' : ' (kirjaa ensin paino)'}`"
        @click="emit('complete')"
      >
        <svg class="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5,13 10,18 19,7" />
        </svg>
      </button>
    </div>
    <p class="mt-2 ml-[34px] text-xs leading-snug text-ink-muted">
      Kirjaa paino kerran, se kopioituu seuraaviin sarjoihin. Ensi kerralla se on valmiina.
    </p>
  </div>

  <!-- Vuorossa -->
  <div
    v-else-if="state === 'current'"
    class="rounded-(--radius-field) border-2 border-[var(--sport-on)] bg-surface p-2 pl-2.5"
  >
    <div class="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class="flex size-6 flex-none items-center justify-center rounded-full bg-[var(--sport-on)] text-xs font-bold text-[var(--sport-surface)]"
      >
        {{ index + 1 }}
      </span>

      <div v-if="!editing" class="min-w-0 flex-1">
        <span class="flex flex-wrap items-center gap-x-2">
          <button
            type="button"
            class="text-left text-[21px] font-bold tracking-[-0.01em]"
            data-numeric
            :aria-label="`${label}, muokkaa`"
            @click="startEdit"
          >
            {{ label }}
          </button>
          <span
            v-if="hintLabel"
            class="rounded-full bg-[var(--sport-surface)] px-2 py-0.5 text-xs font-bold whitespace-nowrap text-[var(--sport-on)]"
          >
            {{ hintLabel }}
          </span>
        </span>
        <span class="block text-[11px] text-ink-muted">
          <template v-if="previousLabel">{{ previousLabel }} · </template>napauta muuttaaksesi
        </span>
      </div>

      <form v-else class="flex min-w-0 flex-1 items-end gap-1.5" @submit.prevent="applyEdit">
        <label v-if="measurement === 'weight_reps'" class="min-w-0 flex-1 text-[11px] font-bold text-ink-muted uppercase">
          kg
          <input
            v-model="weightText"
            type="text"
            inputmode="decimal"
            class="mt-0.5 h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-2 text-lg font-bold text-ink"
            data-numeric
            autofocus
          />
        </label>
        <label v-if="measurement !== 'time'" class="min-w-0 flex-1 text-[11px] font-bold text-ink-muted uppercase">
          toistot
          <input
            v-model="repsText"
            type="text"
            inputmode="numeric"
            class="mt-0.5 h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-2 text-lg font-bold text-ink"
            data-numeric
          />
        </label>
        <label v-else class="min-w-0 flex-1 text-[11px] font-bold text-ink-muted uppercase">
          sekuntia
          <input
            v-model="secondsText"
            type="text"
            inputmode="numeric"
            class="mt-0.5 h-11 w-full min-w-0 rounded-xl border border-line bg-bg px-2 text-lg font-bold text-ink"
            data-numeric
          />
        </label>
        <button type="submit" class="h-11 rounded-xl bg-action px-3 text-sm font-semibold text-on-action">
          OK
        </button>
      </form>

      <button
        type="button"
        class="flex size-12 flex-none items-center justify-center rounded-xl border-2 border-ink bg-transparent text-ink active:bg-action active:text-on-action disabled:opacity-40"
        :disabled="!ready"
        :aria-label="`Merkitse sarja ${index + 1} tehdyksi`"
        @click="emit('complete')"
      >
        <svg class="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5,13 10,18 19,7" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Tulossa -->
  <div v-else class="flex items-center gap-2.5 rounded-(--radius-field) bg-surface/55 py-2 pr-2 pl-3">
    <span
      aria-hidden="true"
      class="flex size-6 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sport-on)_14%,transparent)] text-xs font-bold text-[var(--sport-on)]"
    >
      {{ index + 1 }}
    </span>
    <span class="min-w-0 flex-1 text-[17px] font-semibold text-ink-muted" data-numeric>
      {{ set.weightKg || measurement !== 'weight_reps' ? label : `sama paino × ${set.reps ?? 0}` }}
    </span>
    <span
      aria-hidden="true"
      class="flex size-12 flex-none items-center justify-center rounded-xl border border-line text-line"
    >
      <svg class="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="5,13 10,18 19,7" />
      </svg>
    </span>
  </div>
</template>
