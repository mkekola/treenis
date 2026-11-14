<script setup lang="ts">
import { computed, ref } from 'vue'
import DateChips from '@/components/DateChips.vue'
import DurationInput from '@/components/DurationInput.vue'
import { formatPace } from '@/lib/format'
import { isComplete, parseDistance, suggestedStart, type ManualInput } from '@/lib/manual'
import { localDate } from '@/lib/session'
import { SPORT_KIND } from '@/types/workout'

/**
 * Treenin perustiedot: uusi käsin kirjattu treeni ja tallennetun muokkaus.
 * Värit tulevat lajista kutsujan --sport-* -muuttujista.
 */
const props = withDefaults(
  defineProps<{
    initial: ManualInput
    submitLabel: string
    /** Kellon mittaamia arvoja (aika, kesto, matka, syke) ei muokata: mitattu voittaa. */
    measuredLocked?: boolean
    /** Salilla tuntuma kysytään liikkeittäin, joten koko treenin rasitusta ei kysytä. */
    showRpe?: boolean
    cancelLabel?: string
  }>(),
  { measuredLocked: false, showRpe: true, cancelLabel: '' },
)
const emit = defineEmits<{ submit: [input: ManualInput]; cancel: [] }>()

const now = new Date()
const today = localDate(now)

const title = ref(props.initial.title)
const date = ref(props.initial.date)
const startTime = ref(props.initial.startTime)
const durationSec = ref(props.initial.durationSec)
const swim = props.initial.sport === 'swim'
const distanceText = ref(
  props.initial.distanceM
    ? (swim ? props.initial.distanceM : props.initial.distanceM / 1000).toLocaleString('fi-FI', { maximumFractionDigits: 2 })
    : '',
)
const hrText = ref(props.initial.avgHr ? String(props.initial.avgHr) : '')
const rpe = ref(props.initial.rpe)
const notes = ref(props.initial.notes)

const isDistance = SPORT_KIND[props.initial.sport] === 'distance'
const distanceM = computed(() => parseDistance(distanceText.value, props.initial.sport))
const pace = computed(() =>
  isDistance && distanceM.value && durationSec.value ? formatPace(props.initial.sport, distanceM.value, durationSec.value) : null,
)
/** Tälle päivälle ehdotetaan alkamisajaksi "nyt miinus kesto", menneelle ei arvata. */
const startSuggestion = computed(() => suggestedStart(date.value, durationSec.value, now))

const value = computed<ManualInput>(() => {
  const hr = Number(hrText.value)
  return {
    sport: props.initial.sport,
    title: title.value,
    date: date.value,
    startTime: startTime.value || startSuggestion.value,
    durationSec: durationSec.value,
    distanceM: distanceM.value,
    avgHr: Number.isFinite(hr) && hr > 0 ? Math.round(hr) : undefined,
    rpe: rpe.value,
    notes: notes.value,
  }
})
const complete = computed(() => isComplete(value.value, today))

const field = 'h-12 w-full min-w-0 rounded-(--radius-field) border border-line bg-surface px-3 text-base disabled:bg-track disabled:text-ink-muted'
const label = 'text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase'

function submit() {
  if (complete.value) emit('submit', value.value)
}
</script>

<template>
  <form class="flex flex-col gap-3.5" @submit.prevent="submit">
    <label class="flex flex-col gap-1">
      <span :class="label">Nimi</span>
      <input id="treenin-nimi" v-model="title" type="text" autocomplete="off" :class="field" />
    </label>

    <div class="flex flex-col gap-1">
      <span id="treenin-paiva" :class="label">Päivä</span>
      <DateChips v-model="date" label-id="treenin-paiva" />
    </div>

    <!-- Kesto saa luonnollisen leveytensä, kellonaika joustaa. iPhonen kellonaikakentällä on
         oma minimileveys, joten se pitää sallia kutistuvaksi (min-w-0, appearance-none). -->
    <div class="grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
      <label class="flex min-w-0 flex-col gap-1">
        <span :class="label">Alkoi klo</span>
        <input
          id="treenin-alku"
          v-model="startTime"
          type="time"
          :placeholder="startSuggestion"
          :disabled="measuredLocked"
          :class="[field, 'w-full min-w-0 appearance-none']"
          data-numeric
        />
      </label>
      <div class="flex min-w-0 flex-col gap-1">
        <span id="treenin-kesto" :class="label">Kesto</span>
        <DurationInput v-model="durationSec" label-id="treenin-kesto" :disabled="measuredLocked" />
      </div>
    </div>

    <template v-if="isDistance">
      <div class="grid grid-cols-2 gap-2.5">
        <label class="flex min-w-0 flex-col gap-1">
          <span :class="label">Matka</span>
          <span class="flex items-center gap-1.5">
            <input
              id="treenin-matka"
              v-model="distanceText"
              type="text"
              inputmode="decimal"
              :disabled="measuredLocked"
              :class="field"
              data-numeric
            />
            <span class="text-sm text-ink-muted">{{ swim ? 'm' : 'km' }}</span>
          </span>
        </label>
        <label class="flex min-w-0 flex-col gap-1">
          <span :class="label">Keskisyke <span class="font-medium tracking-normal normal-case">valinnainen</span></span>
          <span class="flex items-center gap-1.5">
            <input
              id="treenin-syke"
              v-model="hrText"
              type="number"
              inputmode="numeric"
              :disabled="measuredLocked"
              :class="field"
              data-numeric
            />
            <span class="text-sm text-ink-muted">bpm</span>
          </span>
        </label>
      </div>
      <p v-if="pace" class="-mt-1.5 text-sm text-ink-muted" data-numeric>Vauhti {{ pace }}</p>
    </template>

    <p v-if="measuredLocked" class="-mt-1 text-[13px] text-ink-muted">
      Aika ja kesto tulevat kellosta Stravan kautta, joten niitä ei muokata täällä.
    </p>

    <div v-if="showRpe" class="flex flex-col gap-1">
      <span id="treenin-rasitus" :class="label">Rasitus</span>
      <div role="group" aria-labelledby="treenin-rasitus" class="grid grid-cols-5 gap-1.5">
        <button
          v-for="n in 10"
          :key="n"
          type="button"
          :aria-pressed="rpe === n"
          :class="rpe === n ? 'border-transparent bg-[var(--sport-surface)] text-[var(--sport-on)]' : 'border-line bg-surface'"
          class="h-11 rounded-xl border font-semibold"
          data-numeric
          @click="rpe = rpe === n ? undefined : n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <label class="flex flex-col gap-1">
      <span :class="label">Muistiinpano</span>
      <textarea
        id="treenin-muistiinpano"
        v-model="notes"
        rows="2"
        placeholder="Miltä tuntui?"
        class="w-full resize-none rounded-(--radius-field) border border-line bg-surface px-3 py-2.5 text-base"
      />
    </label>

    <div class="mt-1 flex gap-2">
      <button
        v-if="cancelLabel"
        type="button"
        class="min-h-13 flex-1 rounded-(--radius-button) border border-line text-base font-semibold"
        @click="emit('cancel')"
      >
        {{ cancelLabel }}
      </button>
      <button
        type="submit"
        :disabled="!complete"
        class="min-h-13 flex-1 rounded-(--radius-button) bg-action text-base font-semibold text-on-action disabled:opacity-40"
      >
        {{ submitLabel }}
      </button>
    </div>
    <p v-if="!complete" class="-mt-1.5 text-center text-xs text-ink-muted">Kirjaa kesto, niin treenin voi tallentaa.</p>
  </form>
</template>
