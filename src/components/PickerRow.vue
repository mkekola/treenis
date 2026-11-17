<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useExercises } from '@/stores/exercises'
import type { Exercise } from '@/types/workout'

/**
 * Liikevalitsimen rivi. Napautus valitsee liikkeen. Vaihdettaessa rivin ⋯-valikosta liikkeen
 * voi kiinnittää korvaajaksi, ja kiinnitetyn nimen vieressä on neula.
 */
const props = defineProps<{
  exercise: Exercise
  detail: string
  /** Vaihdettava liike. Ilman sitä riviltä vain valitaan. */
  substituteFor?: string
}>()
const emit = defineEmits<{ select: [] }>()

const exercises = useExercises()
const menuOpen = ref(false)
const menuId = useId()

const hasMenu = computed(() => props.substituteFor !== undefined && props.substituteFor !== props.exercise.id)
const pinned = computed(
  () => props.substituteFor !== undefined && exercises.pinnedFor(props.substituteFor).includes(props.exercise.id),
)

function togglePin() {
  if (!props.substituteFor) return
  void exercises.togglePin(props.substituteFor, props.exercise.id)
  menuOpen.value = false
}
</script>

<template>
  <li class="flex flex-col gap-1.5">
    <div class="flex gap-1.5">
      <button
        type="button"
        class="flex min-h-12 min-w-0 flex-1 flex-col justify-center rounded-(--radius-field) bg-surface px-3.5 py-2 text-left"
        @click="emit('select')"
      >
        <span class="flex items-center gap-2">
          <span class="text-[15px] font-semibold">{{ exercise.name }}</span>
          <svg
            v-if="pinned"
            class="size-3.5 flex-none"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
            role="img"
            aria-label="kiinnitetty"
          >
            <path d="M9 3h6l-1 7 3 3v1H7v-1l3-3z" />
            <line x1="12" y1="14" x2="12" y2="21" stroke-linecap="round" />
          </svg>
          <span
            v-if="exercise.custom"
            class="rounded-full border border-line px-1.5 text-[10px] font-bold tracking-[0.04em] text-ink-muted uppercase"
          >
            Oma
          </span>
        </span>
        <span class="text-xs text-ink-muted">{{ detail }}</span>
      </button>
      <button
        v-if="hasMenu"
        type="button"
        :aria-label="`Lisää: ${exercise.name}`"
        :aria-expanded="menuOpen"
        :aria-controls="menuId"
        class="flex w-11 flex-none items-center justify-center rounded-(--radius-field) text-ink-muted"
        @click="menuOpen = !menuOpen"
      >
        <svg class="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
    </div>
    <div v-if="hasMenu && menuOpen" :id="menuId">
      <button
        type="button"
        class="min-h-11 w-full rounded-(--radius-button) border border-line text-[15px] font-semibold"
        @click="togglePin"
      >
        {{ pinned ? 'Irrota korvaajista' : 'Kiinnitä korvaajaksi' }}
      </button>
    </div>
  </li>
</template>
