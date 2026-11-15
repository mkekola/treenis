<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'

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

const props = defineProps<{ rows: BlockRow[]; current: number }>()
const emit = defineEmits<{ select: [index: number]; move: [from: number, to: number] }>()

/** Rivien väli (gap-1.5), jotta raahattava rivi jättää täsmälleen oman kokoisensa raon. */
const GAP_PX = 6

const list = useTemplateRef<HTMLUListElement>('list')

interface Drag {
  from: number
  to: number
  startY: number
  dy: number
  /** Raahattavan rivin korkeus väleineen: muut rivit väistävät tämän verran. */
  step: number
  /** Rivien keskikohdat raahauksen alussa. */
  middles: number[]
}
const drag = ref<Drag | null>(null)

function startDrag(index: number, event: PointerEvent) {
  if (!list.value) return
  const rects = [...list.value.children].map((el) => el.getBoundingClientRect())
  drag.value = {
    from: index,
    to: index,
    startY: event.clientY,
    dy: 0,
    step: rects[index].height + GAP_PX,
    middles: rects.map((r) => r.top + r.height / 2),
  }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveDrag(event: PointerEvent) {
  const d = drag.value
  if (!d) return
  d.dy = event.clientY - d.startY
  const middle = d.middles[d.from] + d.dy
  d.to = d.middles.filter((m, i) => i !== d.from && m < middle).length
}

function endDrag() {
  const d = drag.value
  drag.value = null
  if (d && d.to !== d.from) emit('move', d.from, d.to)
}

/** Raahattava rivi seuraa sormea, ja sen ja kohteen väliset rivit väistävät. */
function shift(index: number): string | undefined {
  const d = drag.value
  if (!d) return undefined
  if (index === d.from) return `translateY(${d.dy}px)`
  if (d.from < d.to && index > d.from && index <= d.to) return `translateY(${-d.step}px)`
  if (d.from > d.to && index >= d.to && index < d.from) return `translateY(${d.step}px)`
  return undefined
}

function moveBy(index: number, delta: -1 | 1) {
  const to = index + delta
  if (to >= 0 && to < props.rows.length) emit('move', index, to)
}
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
          @pointerdown="startDrag(index, $event)"
          @pointermove="moveDrag"
          @pointerup="endDrag"
          @pointercancel="endDrag"
          @keydown.up.prevent="moveBy(index, -1)"
          @keydown.down.prevent="moveBy(index, 1)"
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
