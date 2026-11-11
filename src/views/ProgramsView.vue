<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { templatesOf } from '@/lib/program'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'

const router = useRouter()
const programs = usePrograms()
const templates = useTemplates()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))

/** Käytössä oleva ensin, muut aakkosjärjestyksessä. */
const sorted = computed(() => {
  const activeId = programs.active?.id
  return [...programs.programs].sort(
    (a, b) => Number(b.id === activeId) - Number(a.id === activeId) || a.name.localeCompare(b.name, 'fi'),
  )
})

const treenit = (count: number) => (count === 1 ? '1 treeni' : `${count} treeniä`)

async function create() {
  const program = await programs.create('Uusi ohjelma')
  await router.push({ name: 'program', params: { id: program.id }, query: { uusi: '1' } })
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-3 px-5 pt-6" :style="vars">
    <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Ohjelmat</h1>
    <p class="-mt-1 text-[13px] text-ink-muted">
      Ohjelma kokoaa treenit, joita teet vuorotellen. Käytössä olevan ohjelman treenit tulevat
      ensimmäisinä, kun aloitat salitreenin.
    </p>

    <ul class="mb-6 grid grid-cols-2 gap-2.5">
      <li v-for="program in sorted" :key="program.id">
        <RouterLink
          :to="{ name: 'program', params: { id: program.id } }"
          class="flex h-full min-h-36 flex-col gap-1 rounded-(--radius-card) bg-surface p-3.5"
        >
          <span
            v-if="program.id === programs.active?.id"
            class="self-start rounded-full bg-[var(--sport-surface)] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] text-[var(--sport-on)] uppercase"
          >
            Käytössä
          </span>
          <span class="text-[17px] leading-snug font-semibold tracking-[-0.01em] break-words">
            {{ program.name }}
          </span>
          <span class="mt-auto text-[13px] text-ink-muted" data-numeric>
            {{ treenit(templatesOf(program, templates.templates).length) }}
          </span>
        </RouterLink>
      </li>
      <li>
        <button
          type="button"
          class="flex h-full min-h-36 w-full items-center justify-center rounded-(--radius-card) border border-dashed border-ink-muted p-3.5 text-base font-semibold"
          @click="create"
        >
          + Uusi ohjelma
        </button>
      </li>
    </ul>
  </div>
</template>
