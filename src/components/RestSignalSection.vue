<script setup lang="ts">
import { ref } from 'vue'
import { canVibrate, loadRestSignal, saveRestSignal, type RestSignal } from '@/lib/restSignal'

/** Levon loppumerkki treenin aikana, kun Treenis on auki. Laitekohtainen valinta. */
const signal = ref<RestSignal>(loadRestSignal())
const vibrationAvailable = canVibrate()

const OPTIONS: { value: RestSignal; label: string; hint: string }[] = [
  { value: 'sound', label: 'Ääni', hint: 'Kaksi lyhyttä piippausta' },
  ...(vibrationAvailable
    ? [{ value: 'vibrate' as const, label: 'Värinä', hint: 'Puhelin värisee, musiikki ei keskeydy' }]
    : []),
  { value: 'none', label: 'Ei merkkiä', hint: 'Lepo näkyy vain ruudulla' },
]

function choose(value: RestSignal) {
  signal.value = value
  saveRestSignal(value)
}
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5" aria-labelledby="levon-merkki">
    <h2 id="levon-merkki" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
      Levon loppumerkki
    </h2>
    <p class="mt-1 text-[13px] text-ink-muted">Kun lepo päättyy ja Treenis on auki. Koskee tätä laitetta.</p>
    <fieldset class="mt-1">
      <legend class="sr-only">Levon loppumerkki</legend>
      <label
        v-for="option in OPTIONS"
        :key="option.value"
        class="flex min-h-14 items-center gap-3 border-t border-line py-2 first-of-type:border-t-0"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-[15px]">{{ option.label }}</span>
          <span class="block text-[13px] text-ink-muted">{{ option.hint }}</span>
        </span>
        <input
          type="radio"
          name="levon-merkki"
          :value="option.value"
          :checked="signal === option.value"
          class="size-5 accent-[var(--c-action)]"
          @change="choose(option.value)"
        />
      </label>
    </fieldset>
    <p v-if="!vibrationAvailable" class="mt-1 text-[13px] text-ink-muted">
      Värinä ei ole mahdollinen tässä selaimessa.
    </p>
  </section>
</template>
