<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import ProgramChips from '@/components/ProgramChips.vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { programVars } from '@/design/programPalette'
import { usePrograms } from '@/stores/programs'

const router = useRouter()
const programs = usePrograms()
const { isDark } = useTheme()

/** Käytössä oleva ensin, muut aakkosjärjestyksessä. */
const sorted = computed(() => {
  const activeId = programs.active?.id
  return [...programs.programs].sort(
    (a, b) => Number(b.id === activeId) - Number(a.id === activeId) || a.name.localeCompare(b.name, 'fi'),
  )
})

async function create() {
  const program = await programs.create('Uusi ohjelma')
  await router.push({ name: 'program', params: { id: program.id }, query: { uusi: '1' } })
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-3 px-5 pt-6">
    <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Ohjelmat</h1>
    <p class="-mt-1 text-[13px] text-ink-muted">
      Ohjelma kokoaa treenit, joita teet vuorotellen. Käytössä olevan ohjelman treenit tulevat
      ensimmäisinä, kun aloitat salitreenin.
    </p>

    <!-- Julistekortit: ohjelman väri täyttää kortin, ja lajin ikoni rajautuu reunan yli kuin valokuva. -->
    <ul class="mb-6 grid grid-cols-2 gap-2.5">
      <li v-for="program in sorted" :key="program.id">
        <RouterLink
          :to="{ name: 'program', params: { id: program.id } }"
          :style="programVars(program.color, isDark)"
          class="relative flex h-full min-h-44 flex-col justify-between overflow-hidden rounded-(--radius-feature) bg-[var(--program-surface)] p-3.5 text-[var(--program-on)]"
        >
          <SportIcon
            sport="strength"
            :size="180"
            class="pointer-events-none absolute -top-6 -right-16 opacity-20"
          />
          <span class="relative">
            <span
              v-if="program.id === programs.active?.id"
              class="rounded-full bg-[color-mix(in_srgb,var(--program-on)_18%,transparent)] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] uppercase"
            >
              Käytössä
            </span>
          </span>
          <span class="relative flex flex-col gap-2">
            <span class="font-display text-[18px] leading-[1.1] font-bold tracking-[-0.01em] break-words">
              {{ program.name }}
            </span>
            <ProgramChips :program="program" />
          </span>
        </RouterLink>
      </li>
      <li>
        <button
          type="button"
          class="flex h-full min-h-44 w-full items-center justify-center rounded-(--radius-feature) border border-dashed border-ink-muted p-3.5 text-base font-semibold"
          @click="create"
        >
          + Uusi ohjelma
        </button>
      </li>
    </ul>
  </div>
</template>
