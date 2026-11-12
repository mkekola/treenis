<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useVisibleViewport } from '@/composables/useVisibleViewport'
import { MEASUREMENT_LABELS, MUSCLE_GROUP_LABELS } from '@/data/exerciseLibrary'
import { recentExerciseIds } from '@/lib/history'
import { useExercises } from '@/stores/exercises'
import { useWorkouts } from '@/stores/workouts'
import type { Exercise, Measurement, MuscleGroup } from '@/types/workout'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ select: [exercise: Exercise]; close: [] }>()

const exercises = useExercises()
const workouts = useWorkouts()

const dialog = ref<HTMLDialogElement>()
// Koko näkyvän alueen korkuinen ja yläreunaan kiinnitetty: näppäimistö ei peitä hakua eikä listaa.
const viewport = useVisibleViewport()
const query = ref('')

// --- oma liike ---
const creating = ref(false)
const newGroup = ref<MuscleGroup>('chest')
const newMeasurement = ref<Measurement>('weight_reps')
const newPerSide = ref(false)

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      dialog.value?.close()
      return
    }
    query.value = ''
    creating.value = false
    dialog.value?.showModal()
    await nextTick()
    dialog.value?.querySelector<HTMLInputElement>('input[type="search"]')?.focus()
  },
)

const results = computed(() => exercises.search(query.value))

/** Tyhjällä haulla tutut liikkeet ensin: salilla vaihdetaan yleensä liikkeeseen, jonka tuntee. */
const recents = computed<Exercise[]>(() => {
  if (query.value.trim()) return []
  return recentExerciseIds(workouts.workouts, 6)
    .map((id) => exercises.byId.get(id))
    .filter((exercise): exercise is Exercise => exercise !== undefined)
})

/** Oma liike tarjotaan vain kun haulla ei löydy samannimistä, jottei samaa liikettä synny kahta. */
const canCreate = computed(
  () => query.value.trim().length > 1 && !exercises.findByName(query.value),
)

const describe = (exercise: Exercise) =>
  `${MUSCLE_GROUP_LABELS[exercise.muscleGroup]} · ${MEASUREMENT_LABELS[exercise.measurement]}${exercise.perSide ? ' · per puoli' : ''}`

function create() {
  const exercise = exercises.addCustom({
    name: query.value,
    muscleGroup: newGroup.value,
    measurement: newMeasurement.value,
    perSide: newPerSide.value,
  })
  emit('select', exercise)
}

function onNativeClose() {
  if (props.open) emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-label="title"
    :style="{ height: `${viewport.height.value}px`, top: `${viewport.offsetTop.value}px` }"
    class="fixed inset-x-0 bottom-auto m-0 mx-auto max-h-none w-full max-w-[480px] flex-col overflow-hidden bg-bg p-0 pt-[env(safe-area-inset-top)] text-ink backdrop:bg-black/40 open:flex"
    @close="onNativeClose"
    @click="onBackdropClick"
  >
    <header class="flex items-center justify-between gap-3 px-5 pt-4">
      <h2 class="font-display text-[22px] leading-tight font-bold tracking-[-0.02em]">
        {{ creating ? 'Uusi liike' : title }}
      </h2>
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
    </header>

    <!-- Oman liikkeen lomake -->
    <form v-if="creating" class="flex flex-col gap-3 px-5 pt-3 pb-6" @submit.prevent="create">
      <p class="text-[15px] font-semibold">{{ query.trim() }}</p>

      <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Lihasryhmä
        <select
          v-model="newGroup"
          class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-surface px-3 text-[15px] font-normal tracking-normal text-ink normal-case"
        >
          <option v-for="(label, key) in MUSCLE_GROUP_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </label>

      <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Mitä kirjataan
        <select
          v-model="newMeasurement"
          class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-surface px-3 text-[15px] font-normal tracking-normal text-ink normal-case"
        >
          <option v-for="(label, key) in MEASUREMENT_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </label>

      <label class="flex min-h-11 items-center gap-3 text-[15px]">
        <input v-model="newPerSide" type="checkbox" class="size-5 accent-[var(--color-action)]" />
        Yhden puolen liike (kirjattu luku on per puoli)
      </label>

      <div class="mt-1 flex gap-2">
        <button
          type="button"
          class="min-h-12 flex-1 rounded-(--radius-button) border border-line font-semibold"
          @click="creating = false"
        >
          Takaisin
        </button>
        <button
          type="submit"
          class="min-h-12 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action"
        >
          Lisää liike
        </button>
      </div>
    </form>

    <!-- Haku ja lista -->
    <template v-else>
      <div class="px-5 pt-3">
        <label for="liikehaku" class="sr-only">Hae liikettä</label>
        <input
          id="liikehaku"
          v-model="query"
          type="search"
          inputmode="search"
          autocomplete="off"
          placeholder="Hae liikettä, esim. kyykky"
          class="h-12 w-full rounded-(--radius-field) border border-line bg-surface px-3.5 text-base"
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto px-5 pt-2 pb-6">
        <template v-if="recents.length">
          <h3 class="mt-2 mb-1.5 text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Viimeksi tehdyt
          </h3>
          <ul class="flex flex-col gap-1.5">
            <li v-for="exercise in recents" :key="`recent-${exercise.id}`">
              <button
                type="button"
                class="flex min-h-12 w-full flex-col justify-center rounded-(--radius-field) bg-surface px-3.5 py-2 text-left"
                @click="emit('select', exercise)"
              >
                <span class="text-[15px] font-semibold">{{ exercise.name }}</span>
                <span class="text-xs text-ink-muted">{{ describe(exercise) }}</span>
              </button>
            </li>
          </ul>
          <h3 class="mt-4 mb-1.5 text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
            Kaikki liikkeet
          </h3>
        </template>

        <ul class="flex flex-col gap-1.5" :class="{ 'mt-2': !recents.length }">
          <li v-for="exercise in results" :key="exercise.id">
            <button
              type="button"
              class="flex min-h-12 w-full flex-col justify-center rounded-(--radius-field) bg-surface px-3.5 py-2 text-left"
              @click="emit('select', exercise)"
            >
              <span class="flex items-center gap-2">
                <span class="text-[15px] font-semibold">{{ exercise.name }}</span>
                <span
                  v-if="exercise.custom"
                  class="rounded-full border border-line px-1.5 text-[10px] font-bold tracking-[0.04em] text-ink-muted uppercase"
                >
                  Oma
                </span>
              </span>
              <span class="text-xs text-ink-muted">{{ describe(exercise) }}</span>
            </button>
          </li>
        </ul>

        <p v-if="!results.length" class="py-4 text-center text-sm text-ink-muted">
          Ei osumia haulle "{{ query.trim() }}".
        </p>

        <button
          v-if="canCreate"
          type="button"
          class="mt-3 flex min-h-12 w-full items-center justify-center rounded-(--radius-button) border border-dashed border-ink-muted px-3 text-[15px] font-semibold"
          @click="creating = true"
        >
          + Lisää oma liike "{{ query.trim() }}"
        </button>
      </div>
    </template>
  </dialog>
</template>
