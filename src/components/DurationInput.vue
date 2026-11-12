<script setup lang="ts">
import { ref, watch } from 'vue'

/** Kesto tunteina ja minuutteina. Arvo on sekunteina, kuten muualla sovelluksessa. */
const seconds = defineModel<number>({ required: true })
const props = withDefaults(defineProps<{ labelId: string; disabled?: boolean }>(), { disabled: false })

const hours = ref(seconds.value ? String(Math.floor(seconds.value / 3600)) : '')
const minutes = ref(seconds.value ? String(Math.round((seconds.value % 3600) / 60)) : '')

watch([hours, minutes], ([h, m]) => {
  seconds.value = (Number(h) || 0) * 3600 + (Number(m) || 0) * 60
})

const field =
  'h-12 min-w-0 rounded-(--radius-field) border border-line bg-surface px-1 text-center text-base disabled:bg-track disabled:text-ink-muted'
</script>

<template>
  <div role="group" :aria-labelledby="labelId" class="flex items-center gap-1.5">
    <input
      :id="`${labelId}-tunnit`"
      v-model="hours"
      type="number"
      inputmode="numeric"
      min="0"
      max="23"
      aria-label="Tunnit"
      :disabled="props.disabled"
      :class="[field, 'w-14']"
      data-numeric
    />
    <span class="text-sm text-ink-muted">t</span>
    <input
      :id="`${labelId}-minuutit`"
      v-model="minutes"
      type="number"
      inputmode="numeric"
      min="0"
      max="59"
      aria-label="Minuutit"
      :disabled="props.disabled"
      :class="[field, 'w-16']"
      data-numeric
    />
    <span class="text-sm text-ink-muted">min</span>
  </div>
</template>
