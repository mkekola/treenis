<script setup lang="ts">
import { computed } from 'vue'
import { useSync } from '@/stores/sync'

const sync = useSync()

// Näkyy vain kun jokin jää odottamaan. Tavallinen synkka on niin nopea,
// ettei siitä tarvitse kertoa.
const visible = computed(
  () => sync.pending > 0 && (sync.state === 'offline' || sync.state === 'error'),
)

const label = computed(() => {
  // Jonossa voi olla treenien lisäksi pohjia ja omia liikkeitä.
  const count = sync.pending === 1 ? '1 muutos' : `${sync.pending} muutosta`
  return sync.state === 'offline'
    ? `${count} odottaa verkkoa. Lähetetään kun yhteys palaa, tai yritä nyt.`
    : `${count} ei mennyt perille. Yritä uudelleen.`
})
</script>

<template>
  <div role="status">
    <button
      v-if="visible"
      type="button"
      :aria-label="label"
      :title="label"
      class="flex min-h-11 flex-none items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold"
      @click="sync.run()"
    >
      <svg
        class="size-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5" />
        <polyline points="9.5,14.5 12,12 14.5,14.5" />
        <line x1="12" y1="12" x2="12" y2="20" />
      </svg>
      {{ sync.pending }} lähettämättä
    </button>
  </div>
</template>
