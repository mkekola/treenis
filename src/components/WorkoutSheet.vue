<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import WorkoutForm from '@/components/WorkoutForm.vue'
import { useTheme } from '@/composables/useTheme'
import { formatClock, formatSet, formatShortDate, workoutMetrics } from '@/lib/format'
import { applyEdit, inputFromWorkout, type ManualInput } from '@/lib/manual'
import { isFromStrava } from '@/lib/workout'
import { useExercises } from '@/stores/exercises'
import { useSession } from '@/stores/session'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useWorkouts } from '@/stores/workouts'
import { SPORT_LABELS, type Workout } from '@/types/workout'

const props = defineProps<{ workout: Workout | null }>()
const emit = defineEmits<{ close: []; remove: [id: string]; copy: [workout: Workout] }>()

const exercises = useExercises()
const store = useWorkouts()
const session = useSession()
const colors = useSportColors()
const { isDark } = useTheme()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const confirming = ref(false)
const editing = ref(false)

const vars = computed(() => (props.workout ? sportVars(colors.swatchFor(props.workout.sport), isDark.value) : {}))

/** Salitreenin kopio aloittaa uuden treenin, joten se ei onnistu kesken toisen. */
const copyBlocked = computed(() => props.workout?.sport === 'strength' && session.active !== null)

async function saveEdit(input: ManualInput) {
  if (!props.workout) return
  await store.save(applyEdit(props.workout, input))
  editing.value = false
}

watch(
  () => props.workout?.id,
  () => {
    confirming.value = false
    editing.value = false
  },
)

watch(
  () => props.workout,
  async (workout) => {
    if (!workout) {
      dialog.value?.close()
      return
    }
    await nextTick()
    if (!dialog.value?.open) dialog.value?.showModal()
  },
)

const startedAt = computed(() => props.workout?.logged?.startedAt ?? props.workout?.measured?.startedAt)
const metrics = computed(() => (props.workout ? workoutMetrics(props.workout) : []))
const fromStrava = computed(() => (props.workout ? isFromStrava(props.workout) : false))

/** Tehdyt liikkeet järjestyksessä, kukin sarjoineen. */
const lifts = computed(() =>
  (props.workout?.logged?.blocks ?? []).flatMap((block) =>
    block.exercises.map((entry) => {
      const definition = exercises.byId.get(entry.exerciseId)
      const measurement = definition?.measurement ?? 'weight_reps'
      return {
        key: `${block.id}-${entry.exerciseId}`,
        name: definition?.name ?? entry.exerciseId,
        sets: entry.sets.filter((set) => set.done).map((set) => formatSet(set, measurement)),
      }
    }),
  ),
)

function onNativeClose() {
  if (props.workout) emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="treenin-tiedot"
    :style="vars"
    class="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/40 open:flex"
    @close="onNativeClose"
    @click="onBackdropClick"
  >
    <div v-if="workout" class="flex flex-col gap-3 overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p v-if="editing" class="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase">
            {{ SPORT_LABELS[workout.sport] }}
          </p>
          <p v-else class="text-xs font-semibold tracking-[0.08em] text-ink-muted uppercase" data-numeric>
            {{ SPORT_LABELS[workout.sport] }} · {{ formatShortDate(workout.date) }}
            <template v-if="startedAt"> klo {{ formatClock(startedAt) }}</template>
          </p>
          <h2
            id="treenin-tiedot"
            class="mt-1 font-display text-[22px] leading-tight font-bold tracking-[-0.02em] break-words"
          >
            {{ editing ? 'Muokkaa treeniä' : workout.title }}
          </h2>
        </div>
        <button
          type="button"
          aria-label="Sulje"
          class="flex size-11 flex-none items-center justify-center rounded-full border border-line bg-surface"
          @click="emit('close')"
        >
          <svg class="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" />
            <line x1="18" y1="6" x2="6" y2="18" />
          </svg>
        </button>
      </div>

      <!-- Muokkaus korjaa esimerkiksi vahingossa tallennetun päivän tai keston. -->
      <WorkoutForm
        v-if="editing"
        :initial="inputFromWorkout(workout)"
        :measured-locked="fromStrava"
        :show-rpe="workout.sport !== 'strength'"
        submit-label="Tallenna"
        cancel-label="Peruuta"
        @submit="saveEdit"
        @cancel="editing = false"
      />

      <template v-else>
        <p v-if="metrics.length" class="flex flex-wrap gap-x-3.5 text-[15px]" data-numeric>
          <span v-for="metric in metrics" :key="metric">{{ metric }}</span>
        </p>
        <p v-if="fromStrava" class="-mt-2 text-[13px] text-ink-muted">Kesto ja syke Stravasta.</p>

        <ul v-if="lifts.length" class="flex flex-col divide-y divide-line rounded-(--radius-card) bg-surface px-3.5">
          <li v-for="lift in lifts" :key="lift.key" class="py-2.5">
            <p class="text-[15px] font-semibold">{{ lift.name }}</p>
            <p class="text-[13px] text-ink-muted" data-numeric>{{ lift.sets.join(' · ') }}</p>
          </li>
        </ul>

        <p v-if="workout.logged?.notes" class="text-[15px] whitespace-pre-line">{{ workout.logged.notes }}</p>

        <div v-if="!confirming" class="mt-1 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="min-h-12 rounded-(--radius-button) border border-line font-semibold"
            @click="editing = true"
          >
            Muokkaa
          </button>
          <button
            type="button"
            :disabled="copyBlocked"
            class="min-h-12 rounded-(--radius-button) border border-line font-semibold disabled:opacity-40"
            @click="emit('copy', workout)"
          >
            Kopioi uudeksi
          </button>
        </div>
        <p v-if="copyBlocked && !confirming" class="-mt-1 text-center text-xs text-ink-muted">
          Salitreeni on jo kesken. Päätä se ensin, niin voit kopioida tämän.
        </p>

        <!-- Poisto vain varmistuksen kautta: kirjattuja sarjoja ei saa takaisin. -->
        <button
          v-if="!confirming"
          type="button"
          class="min-h-12 rounded-(--radius-button) text-[15px] font-semibold text-ink-muted"
          @click="confirming = true"
        >
          Poista treeni
        </button>
        <div v-else role="group" aria-labelledby="poiston-varmistus" class="mt-1 flex flex-col gap-2">
          <p id="poiston-varmistus" class="text-[15px]">
            Poistetaanko {{ workout.title }}? Tätä ei voi perua.
            <template v-if="fromStrava"> Stravasta treeni ei poistu, eikä se palaa Treenikseen.</template>
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="min-h-12 flex-1 rounded-(--radius-button) border border-line font-semibold"
              @click="confirming = false"
            >
              Peruuta
            </button>
            <button
              type="button"
              class="min-h-12 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action"
              @click="emit('remove', workout.id)"
            >
              Poista
            </button>
          </div>
        </div>
      </template>
    </div>
  </dialog>
</template>
