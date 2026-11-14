<script setup lang="ts">
import { useTheme, type ThemeMode } from '@/composables/useTheme'

const { mode } = useTheme()

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Järjestelmä' },
  { value: 'light', label: 'Vaalea' },
  { value: 'dark', label: 'Tumma' },
]
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Teema</h2>
    <div
      role="group"
      aria-label="Teema"
      class="mt-2.5 grid grid-cols-3 gap-1 rounded-full bg-track p-1"
    >
      <button
        v-for="option in themeOptions"
        :key="option.value"
        type="button"
        class="min-h-9 rounded-full text-sm font-semibold"
        :class="
          mode === option.value ? 'bg-surface text-ink' : 'bg-transparent text-ink-muted'
        "
        :aria-pressed="mode === option.value"
        @click="mode = option.value"
      >
        {{ option.label }}
      </button>
    </div>
    <p class="mt-2 text-xs text-ink-muted">
      Järjestelmä seuraa puhelimen asetusta ja vaihtuu sen mukana. Lajivärit vaihtavat paria
      automaattisesti teeman mukana.
    </p>
  </section>
</template>
