<script setup lang="ts">
import { useTemplateRef } from 'vue'
import { useDragReorder } from '@/composables/useDragReorder'

/**
 * Treenin liikkeet järjestyksessä. Rivin napautus vie liikkeeseen, kahvasta raahaamalla
 * vaihtaa järjestystä. Näppäimistöllä kahva siirtyy nuolinäppäimillä.
 */
export interface BlockRow {
  id: string
  name: string
  done: number
  total: number
  finished: boolean
}

defineProps<{ rows: BlockRow[]; current: number }>()
const emit = defineEmits<{ select: [index: number]; move: [from: number, to: number] }>()

/** Rivien väli (gap-1.5), jotta raahattava rivi jättää täsmälleen oman kokoisensa raon. */
const GAP_PX = 6

const list = useTemplateRef<HTMLUListElement>('list')
const { drag, start, move, end, shift, moveBy } = useDragReorder(list, GAP_PX, (from, to) => emit('move', from, to))
</script>

<template>
  <ul ref="list" class="flex flex-col gap-1.5">
    <li
      v-for="(row, index) in rows"
      :key="row.id"
      :style="{ transform: shift(index) }"
      class="relative"
      :class="drag?.from === index ? 'z-10' : 'transition-transform duration-150 ease-out motion-reduce:transition-none'"
    >
      <div
        class="flex items-center rounded-(--radius-field) border-2"
        :class="[
          index === current
            ? 'border-[var(--sport-on)] bg-[var(--sport-surface)] text-[var(--sport-on)]'
            : row.finished
              ? 'border-transparent bg-surface opacity-60'
              : 'border-[var(--sport-surface)] bg-surface',
          drag?.from === index ? 'outline-2 outline-ink' : '',
        ]"
      >
        <button
          type="button"
          :aria-label="`Siirrä ${row.name}. Raahaa tai käytä nuolinäppäimiä.`"
          class="flex size-11 flex-none cursor-grab touch-none items-center justify-center text-ink-muted active:cursor-grabbing"
          @pointerdown="start(index, $event)"
          @pointermove="move"
          @pointerup="end"
          @pointercancel="end"
          @keydown.up.prevent="moveBy(index, -1, rows.length)"
          @keydown.down.prevent="moveBy(index, 1, rows.length)"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <circle cx="5.5" cy="3.5" r="1.5" />
            <circle cx="10.5" cy="3.5" r="1.5" />
            <circle cx="5.5" cy="8" r="1.5" />
            <circle cx="10.5" cy="8" r="1.5" />
            <circle cx="5.5" cy="12.5" r="1.5" />
            <circle cx="10.5" cy="12.5" r="1.5" />
          </svg>
        </button>
        <button
          type="button"
          :aria-current="index === current ? 'step' : undefined"
          class="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 py-2 pr-3.5 text-left"
          @click="emit('select', index)"
        >
          <span class="min-w-0 flex-1 truncate text-[15px] font-semibold">{{ row.name }}</span>
          <span v-if="index === current" class="text-xs font-bold tracking-[0.06em] uppercase">Nyt</span>
          <span class="text-[13px]" :class="index === current ? '' : 'text-ink-muted'" data-numeric>{{ row.done }} / {{ row.total }}</span>
          <svg v-if="row.finished" class="size-4 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-label="Tehty">
            <polyline points="5,13 10,18 19,7" />
          </svg>
        </button>
      </div>
    </li>
  </ul>
</template>
