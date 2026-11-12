<script setup lang="ts">
import { useId } from 'vue'
import { FEEL_LABELS, type Feel } from '@/types/workout'

defineProps<{
  feel?: Feel
  /** Mitä vastaus teki, esim. "Ensi kerralle ehdotus 24 kg (+2)". */
  message?: string | null
  skipped?: boolean
}>()

const emit = defineEmits<{ select: [feel: Feel]; skip: [] }>()

const titleId = useId()

// Kolme ylärivillä, kaksi keskitettynä alla.
const rows: Feel[][] = [
  ['very_easy', 'easy', 'right'],
  ['hard', 'max'],
]
</script>

<template>
  <div class="mt-2.5 rounded-(--radius-card) bg-[var(--sport-raised)] p-3.5">
    <div class="flex items-baseline justify-between gap-2">
      <h3 :id="titleId" class="text-base font-bold tracking-[-0.01em]">Miltä tuntui?</h3>
      <button
        v-if="!feel && !skipped"
        type="button"
        class="min-h-8 rounded-full px-3 text-[13px] font-semibold text-ink-muted"
        @click="emit('skip')"
      >
        Ohita
      </button>
    </div>

    <div role="group" :aria-labelledby="titleId" class="mt-2.5 flex flex-col gap-1.5">
      <div v-for="(row, rowIndex) in rows" :key="rowIndex" class="flex justify-center gap-1.5">
        <button
          v-for="option in row"
          :key="option"
          type="button"
          class="min-h-12 flex-1 rounded-(--radius-field) px-1 text-sm"
          :class="
            feel === option
              ? 'bg-action font-bold text-on-action'
              : 'border border-line font-semibold'
          "
          :aria-pressed="feel === option"
          :style="rowIndex === 1 ? { flexBasis: 'calc(33.333% - 4px)', flexGrow: 0 } : undefined"
          @click="emit('select', option)"
        >
          {{ FEEL_LABELS[option] }}
        </button>
      </div>
    </div>

    <!-- Palaute heti vastauksen jälkeen: käyttäjä näkee mitä vastaus teki. -->
    <p
      v-if="message"
      class="mt-3 flex items-center gap-2 rounded-xl bg-[var(--sport-surface)] px-3 py-2.5 text-[13px] text-[var(--sport-on)]"
      data-numeric
    >
      {{ message }}
    </p>
  </div>
</template>
