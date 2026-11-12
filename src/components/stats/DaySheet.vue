<script setup lang="ts">
import { computed, nextTick, useTemplateRef, watch } from 'vue'
import WorkoutCard from '@/components/WorkoutCard.vue'
import { formatToday, newestFirst } from '@/lib/calendar'
import { formatDurationShort } from '@/lib/format'
import { totalSeconds } from '@/lib/stats'
import { useWorkouts } from '@/stores/workouts'

/** Kalenteripäivän treenit. Kortti avaa tiedot (open), ja niiden sulkeminen palaa tähän. */
const props = defineProps<{ date: string | null }>()
const emit = defineEmits<{ close: []; open: [id: string] }>()

const store = useWorkouts()
const dialog = useTemplateRef<HTMLDialogElement>('dialog')

const workouts = computed(() => (props.date ? newestFirst(store.workouts.filter((w) => w.date === props.date)) : []))
const title = computed(() => (props.date ? formatToday(new Date(`${props.date}T00:00:00`)) : ''))
const summary = computed(() => {
  const count = workouts.value.length
  return `${count} ${count === 1 ? 'treeni' : 'treeniä'} · ${formatDurationShort(totalSeconds(workouts.value))}`
})

watch(
  () => props.date,
  async (date) => {
    if (!date) {
      dialog.value?.close()
      return
    }
    await nextTick()
    if (!dialog.value?.open) dialog.value?.showModal()
  },
)

// Jos päivän viimeinen treeni poistetaan, tyhjää paneelia ei jätetä auki.
watch(workouts, (list) => {
  if (props.date && list.length === 0) emit('close')
})

function onNativeClose() {
  if (props.date) emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    aria-labelledby="paivan-treenit"
    class="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-3xl bg-bg p-0 text-ink backdrop:bg-black/40 open:flex"
    @close="onNativeClose"
    @click="onBackdropClick"
  >
    <div v-if="date" class="flex flex-col gap-3 overflow-y-auto px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 id="paivan-treenit" class="font-display text-[22px] leading-tight font-bold tracking-[-0.02em]">
            {{ title }}
          </h2>
          <p class="mt-0.5 text-[13px] text-ink-muted" data-numeric>{{ summary }}</p>
        </div>
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
      </div>

      <WorkoutCard
        v-for="workout in workouts"
        :key="workout.id"
        :workout="workout"
        @open="emit('open', $event)"
        @confirm-match="store.confirmMatch"
        @reject-match="store.rejectMatch"
      />
    </div>
  </dialog>
</template>
