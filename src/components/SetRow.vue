<script setup lang="ts">
import { computed, nextTick, ref, useId, useTemplateRef, watch } from 'vue'
import { formatDuration } from '@/lib/format'
import { canComplete } from '@/lib/session'
import { formatWorkTime } from '@/lib/timed'
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
  /** Aikasarjan työaika. Silloin toistot kirjataan ajan jälkeen. */
  workSec?: number
  /** Jäljellä oleva työaika, kun tämän rivin ajastin on käynnissä. */
  workLeft?: number
}>()

const emit = defineEmits<{
  complete: []
  undo: []
  edit: [values: SetValues]
  'start-work': []
  'stop-work': []
}>()

const kgFormat = new Intl.NumberFormat('fi-FI', { maximumFractionDigits: 2 })
const kg = (value: number) => kgFormat.format(value)

const timed = computed(() => props.workSec !== undefined)
const running = computed(() => props.workLeft !== undefined)

/** "62,5 kg × 12", "× 12" kun painoa ei ole vielä kirjattu. Aikasarja ilman toistoja: "1 min". */
const label = computed(() => {
  const { weightKg, reps, durationSec } = props.set
  if (props.measurement === 'time') return `${durationSec ?? 0} s`
  if (timed.value && reps === undefined) {
    const time = formatWorkTime(props.workSec!)
    return props.measurement === 'weight_reps' && weightKg ? `${kg(weightKg)} kg · ${time}` : time
  }
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
    // Aikasarjassa paino kirjataan ajan jälkeen toistojen kanssa, jotta ajastimen voi käynnistää heti.
    else if (measurement === 'weight_reps' && !weight && !timed.value) prompting.value = true
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
  const parts = [
    previous.weightKg !== undefined ? `${kg(previous.weightKg)} kg` : null,
    previous.reps !== undefined ? `${previous.reps} toistoa` : null,
  ].filter(Boolean)
  return parts.length ? `viimeksi ${parts.join(' × ')}${feel}` : null
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

const repsInput = useTemplateRef<HTMLInputElement>('repsInput')

function startEdit() {
  weightText.value = props.set.weightKg ? String(props.set.weightKg).replace('.', ',') : ''
  repsText.value = props.set.reps ? String(props.set.reps) : ''
  secondsText.value = props.set.durationSec ? String(props.set.durationSec) : ''
  editing.value = true
}

// Kun työaika loppuu tai sen lopettaa, toistokenttä aukeaa valmiiksi kirjoitettavaksi.
watch(running, async (now, before) => {
  if (!before || now) return
  startEdit()
  await nextTick()
  repsInput.value?.focus()
})

function applyEdit() {
  emit('edit', edited.value)
  editing.value = false
}

/** Muokattavat arvot sellaisinaan, jotta ruksi tietää, kelpaavatko ne jo. */
const edited = computed<SetValues>(() => ({
  weightKg: parse(weightText.value),
  reps: parse(repsText.value),
  durationSec: parse(secondsText.value),
}))

/** Ruksin saa painaa, kun sarja on valmis, tai muokkauksen aikana, kun muokatut arvot ovat valmiit. */
const canFinish = computed(() =>
  editing.value ? canComplete({ ...props.set, ...edited.value }, props.measurement) : ready.value,
)

/** Ruksi muokkauksen aikana tallentaa muutokset ja merkitsee sarjan tehdyksi samalla painalluksella. */
function onComplete() {
  if (editing.value) applyEdit()
  emit('complete')
}

/** Ensimmäisen kerran kentät tallentavat jo kirjoittaessa, jotta merkintä aktivoituu heti. */
function onWeightInput(event: Event) {
  const value = parse((event.target as HTMLInputElement).value)
  if (value !== undefined) emit('edit', { weightKg: value })
}

function onRepsInput(event: Event) {
  const value = parse((event.target as HTMLInputElement).value)
  if (value !== undefined && Number.isInteger(value)) emit('edit', { reps: value })
}

const rowId = useId()
</script>

<template>
  <!-- Tehty -->
  <div
    v-if="state === 'done'"
    class="flex items-center gap-2.5 rounded-(--radius-field) bg-[var(--sport-raised)] py-2 pr-2 pl-3"
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
    class="rounded-(--radius-field) border-2 border-[var(--sport-on)] bg-[var(--sport-raised)] p-2 pl-2.5"
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
            class="mt-0.5 h-12 w-full min-w-0 rounded-xl border-2 border-dashed border-[var(--sport-on)] bg-[var(--sport-sunken)] px-3 text-[22px] font-bold tracking-[-0.01em]"
            data-numeric
            @input="onWeightInput"
          />
        </span>
        <span class="pb-3 text-[21px] font-bold" aria-hidden="true">×</span>
        <span class="w-16 flex-none">
          <label
            :for="`${rowId}-toistot`"
            class="block text-[11px] font-bold tracking-[0.06em] text-[var(--sport-on)] uppercase"
          >
            Toistot
          </label>
          <input
            :id="`${rowId}-toistot`"
            type="text"
            inputmode="numeric"
            :value="set.reps ?? ''"
            class="mt-0.5 h-12 w-full min-w-0 rounded-xl border-2 border-[var(--sport-on)] bg-[var(--sport-sunken)] px-2 text-center text-[22px] font-bold"
            data-numeric
            @input="onRepsInput"
          />
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
    class="rounded-(--radius-field) border-2 border-[var(--sport-on)] bg-[var(--sport-raised)] p-2 pl-2.5"
  >
    <div class="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        class="flex size-6 flex-none items-center justify-center rounded-full bg-[var(--sport-on)] text-xs font-bold text-[var(--sport-surface)]"
      >
        {{ index + 1 }}
      </span>

      <!-- Aikasarjan työaika käynnissä: jäljellä oleva aika isona, palkki ja lopetus. -->
      <div v-if="running" class="min-w-0 flex-1">
        <span class="flex items-center gap-3">
          <span class="font-display text-[34px] leading-none font-bold tracking-[-0.02em]" role="timer" data-numeric>
            {{ formatDuration(workLeft ?? 0) }}
          </span>
          <button
            type="button"
            class="ml-auto min-h-11 rounded-full border border-line bg-bg px-4 text-[15px] font-semibold"
            @click="emit('stop-work')"
          >
            Lopeta
          </button>
        </span>
        <span class="mt-2.5 block h-1.5 overflow-hidden rounded-full bg-[var(--sport-surface)]" aria-hidden="true">
          <span
            class="block h-full rounded-full bg-[var(--sport-on)]"
            :style="{ width: `${Math.round(((workLeft ?? 0) / (workSec ?? 1)) * 100)}%` }"
          />
        </span>
      </div>

      <div v-else-if="!editing" class="min-w-0 flex-1">
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
          <template v-if="previousLabel">{{ previousLabel }} · </template>
          <template v-if="timed && set.reps === undefined">aloita ▶, kirjaa toistot ajan jälkeen</template>
          <template v-else>napauta muuttaaksesi</template>
        </span>
      </div>

      <form v-else class="flex min-w-0 flex-1 items-end gap-1.5" @submit.prevent="applyEdit">
        <label v-if="measurement === 'weight_reps'" class="min-w-0 flex-1 text-[11px] font-bold text-ink-muted uppercase">
          kg
          <input
            v-model="weightText"
            type="text"
            inputmode="decimal"
            class="mt-0.5 h-11 w-full min-w-0 rounded-xl border border-line bg-[var(--sport-sunken)] px-2 text-lg font-bold text-ink"
            data-numeric
            autofocus
          />
        </label>
        <label v-if="measurement !== 'time'" class="min-w-0 flex-1 text-[11px] font-bold text-ink-muted uppercase">
          toistot
          <input
            ref="repsInput"
            v-model="repsText"
            type="text"
            inputmode="numeric"
            class="mt-0.5 h-11 w-full min-w-0 rounded-xl border border-line bg-[var(--sport-sunken)] px-2 text-lg font-bold text-ink"
            data-numeric
          />
        </label>
        <label v-else class="min-w-0 flex-1 text-[11px] font-bold text-ink-muted uppercase">
          sekuntia
          <input
            v-model="secondsText"
            type="text"
            inputmode="numeric"
            class="mt-0.5 h-11 w-full min-w-0 rounded-xl border border-line bg-[var(--sport-sunken)] px-2 text-lg font-bold text-ink"
            data-numeric
          />
        </label>
        <button type="submit" class="h-11 rounded-xl bg-action px-3 text-sm font-semibold text-on-action">
          OK
        </button>
      </form>

      <!-- Aikasarja ennen toistoja: ruksin paikalla ajastimen käynnistys. -->
      <button
        v-if="timed && !running && !editing && set.reps === undefined"
        type="button"
        class="flex h-12 flex-none items-center gap-1.5 rounded-full bg-[var(--sport-on)] px-3.5 text-[15px] font-bold text-[var(--sport-surface)]"
        :aria-label="`Aloita sarja ${index + 1}, ${formatWorkTime(workSec!)}`"
        @click="emit('start-work')"
      >
        <svg class="size-3.5" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
          <polygon points="2,1 11,6 2,11" />
        </svg>
        <span data-numeric>{{ formatDuration(workSec!) }}</span>
      </button>
      <button
        v-else-if="!running"
        type="button"
        class="flex size-12 flex-none items-center justify-center rounded-xl border-2 border-ink bg-transparent text-ink active:bg-action active:text-on-action disabled:opacity-40"
        :disabled="!canFinish"
        :aria-label="`Merkitse sarja ${index + 1} tehdyksi${editing ? ' ja tallenna muutokset' : ''}`"
        @click="onComplete"
      >
        <svg class="size-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5,13 10,18 19,7" />
        </svg>
      </button>
    </div>
  </div>

  <!-- Tulossa -->
  <div v-else class="flex items-center gap-2.5 rounded-(--radius-field) bg-[color-mix(in_srgb,var(--sport-raised)_55%,transparent)] py-2 pr-2 pl-3">
    <span
      aria-hidden="true"
      class="flex size-6 flex-none items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--sport-on)_14%,transparent)] text-xs font-bold text-[var(--sport-on)]"
    >
      {{ index + 1 }}
    </span>
    <span class="min-w-0 flex-1 text-[17px] font-semibold text-ink-muted" data-numeric>
      {{ set.weightKg || measurement !== 'weight_reps' || timed ? label : `sama paino × ${set.reps ?? 0}` }}
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
