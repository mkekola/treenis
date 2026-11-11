<script setup lang="ts">
import { computed } from 'vue'
import { PROGRAM_LEVEL_LABELS, type Program, type ProgramLevel } from '@/types/workout'

const props = defineProps<{
  program: Program
  /** Tasolla myös sana. Kapeassa kortissa näkyy vain palkkimerkki. */
  long?: boolean
}>()

const LEVEL_BARS: Record<ProgramLevel, number> = { beginner: 1, intermediate: 2, advanced: 3 }

/** Kertaa viikossa ei kysytä: se on ohjelman treenien määrä. */
const perWeek = computed(() => props.program.templateIds.length)
</script>

<template>
  <ul class="flex flex-wrap gap-1.5">
    <li v-if="perWeek" class="chip" data-numeric>{{ perWeek }} krt/vko</li>
    <li v-if="program.durationWeeks" class="chip" data-numeric>
      {{ program.durationWeeks }} {{ long ? 'viikkoa' : 'vk' }}
    </li>
    <li v-if="program.level" class="chip">
      <span class="flex h-[11px] items-end gap-0.5" aria-hidden="true">
        <i
          v-for="bar in 3"
          :key="bar"
          class="block w-[3px] rounded-[1px] bg-current"
          :class="bar <= LEVEL_BARS[program.level] ? '' : 'opacity-30'"
          :style="{ height: `${2 + bar * 3}px` }"
        />
      </span>
      <span :class="long ? '' : 'sr-only'">{{ PROGRAM_LEVEL_LABELS[program.level] }}</span>
    </li>
  </ul>
</template>

<style scoped>
/* Pilleri ohjelmavärin päällä: läpikuultava vaalea, jotta väri näkyy läpi. */
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  background: color-mix(in srgb, var(--program-on) 18%, transparent);
  color: var(--program-on);
}
</style>
