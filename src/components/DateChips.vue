<script setup lang="ts">
import { localDate } from '@/lib/session'

/** Päivän valinta: Tänään, Eilen tai puhelimen oma päivävalitsin. Tulevaa päivää ei voi valita. */
const date = defineModel<string>({ required: true })
defineProps<{ labelId: string }>()

const now = new Date()
const today = localDate(now)
const yesterday = localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))

const chip = 'min-h-11 rounded-full px-3.5 text-sm font-semibold'
const on = 'bg-[var(--sport-surface)] text-[var(--sport-on)]'
const off = 'bg-track text-ink-muted'
</script>

<template>
  <div role="group" :aria-labelledby="labelId" class="flex flex-wrap gap-1.5">
    <button type="button" :class="[chip, date === today ? on : off]" :aria-pressed="date === today" @click="date = today">
      Tänään
    </button>
    <button type="button" :class="[chip, date === yesterday ? on : off]" :aria-pressed="date === yesterday" @click="date = yesterday">
      Eilen
    </button>
    <!-- Korostuu, kun valittuna on muu kuin tänään tai eilen. -->
    <input
      :id="`${labelId}-paiva`"
      v-model="date"
      type="date"
      :max="today"
      required
      aria-label="Valitse päivä"
      :class="[chip, date !== today && date !== yesterday ? on : off]"
    />
  </div>
</template>
