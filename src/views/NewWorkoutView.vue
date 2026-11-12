<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import RecoveryCard from '@/components/RecoveryCard.vue'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { formatShortDate } from '@/lib/format'
import { inRotation, templatesOf, unassigned } from '@/lib/program'
import { localDate } from '@/lib/session'
import { exerciseCount } from '@/lib/template'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useSession } from '@/stores/session'
import { useTemplates } from '@/stores/templates'
import type { WorkoutTemplate } from '@/types/workout'

const router = useRouter()
const session = useSession()
const templates = useTemplates()
const programs = usePrograms()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))

/**
 * Käytössä olevan ohjelman treenit vuorojärjestyksessä: ensimmäisenä se,
 * jota ei ole tehty pisimpään. Kaksi treeniä vuorotellen kulkee itsestään.
 */
const ordered = computed(() =>
  programs.active ? inRotation(templatesOf(programs.active, templates.templates)) : [],
)

/**
 * Vain käytössä olevan ohjelman treenit: toisen ohjelman treeni aloitetaan
 * ottamalla ohjelma käyttöön. Ohjelmattomat pohjat näytetään tyhjästä
 * aloittamisen kanssa, koska muualla niitä ei näytetä.
 */
const loose = computed(() => unassigned(programs.programs, templates.templates))

/** Tyhjä treeni: liikkeet haetaan itse, ja valmiin treenin voi tallentaa pohjaksi. */
async function beginBlank() {
  await session.start()
  await router.push('/treeni')
}

/** Treenin napautus avaa aina esikatselun: liikkeet ja tämän kerran painot näkyvät ennen aloitusta. */
async function preview(template: WorkoutTemplate) {
  await router.push({ name: 'preview', params: { templateId: template.id } })
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-5">
    <RouterLink
      to="/kirjaa"
      aria-label="Takaisin lajivalintaan"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>

    <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">
      Uusi salitreeni
    </h1>

    <!-- Keskeneräinen treeni ratkaistaan ensin, jotta kahta ei ole käynnissä yhtä aikaa. -->
    <template v-if="session.recovery">
      <p class="text-[13px] text-ink-muted">
        Päätä tai hylkää keskeneräinen treeni ennen kuin aloitat uuden.
      </p>
      <RecoveryCard />
    </template>

    <template v-else>
      <p class="text-[13px] text-ink-muted">
        Pohja täyttää liikkeet ja viime kerran painot valmiiksi. Merkitset vain mitä oikeasti teit.
      </p>

      <h2
        v-if="programs.active && ordered.length"
        class="mt-2 text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase"
      >
        {{ programs.active.name }}
      </h2>

      <button
        v-for="(template, index) in ordered"
        :key="template.id"
        type="button"
        :style="vars"
        class="flex items-center gap-3 rounded-(--radius-card) bg-surface p-3.5 text-left"
        @click="preview(template)"
      >
        <span
          aria-hidden="true"
          class="flex size-13 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]"
        >
          <SportIcon sport="strength" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2">
            <span class="text-[17px] font-semibold tracking-[-0.01em]">{{ template.name }}</span>
            <span
              v-if="index === 0 && ordered.length > 1"
              class="rounded-full bg-[var(--sport-surface)] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] text-[var(--sport-on)] uppercase"
            >
              Seuraavaksi
            </span>
          </span>
          <span class="mt-0.5 block text-[13px] text-ink-muted" data-numeric>
            {{ exerciseCount(template) }} liikettä ·
            {{
              template.lastUsedAt
                ? `viimeksi ${formatShortDate(localDate(new Date(template.lastUsedAt)))}`
                : 'ei tehty vielä'
            }}
          </span>
        </span>
        <svg class="size-[18px] flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9,6 15,12 9,18" />
        </svg>
      </button>

      <!-- Oma osio, jottei tyhjä treeni näytä kuuluvan käytössä olevaan ohjelmaan. -->
      <section class="mt-3 flex flex-col gap-1.5">
        <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Ilman ohjelmaa</h2>
        <button
          v-for="template in loose"
          :key="template.id"
          type="button"
          class="flex min-h-12 items-center justify-between gap-3 rounded-(--radius-card) bg-surface px-3.5 py-2.5 text-left"
          @click="preview(template)"
        >
          <span class="font-semibold">{{ template.name }}</span>
          <span class="text-[13px] text-ink-muted" data-numeric>
            {{ exerciseCount(template) }} liikettä
          </span>
        </button>
        <button
          type="button"
          class="flex min-h-13 items-center justify-center gap-2 rounded-(--radius-button) border border-line text-base font-semibold"
          @click="beginBlank"
        >
          + Aloita tyhjästä
        </button>
      </section>
      <div class="pb-6" />
    </template>
  </div>
</template>
