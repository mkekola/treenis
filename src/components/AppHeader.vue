<script setup lang="ts">
import { computed } from 'vue'
import AppLogo from '@/components/AppLogo.vue'
import SyncBadge from '@/components/SyncBadge.vue'
import { useTheme } from '@/composables/useTheme'
import { SWATCHES_BY_ID } from '@/design/swatches'
import { useAuth } from '@/stores/auth'
import { sportVars } from '@/stores/sportColors'

/** Pallo on neutraali savu, ei minkään lajin väri: se on tili ja asetukset, ei treeni. */
const AVATAR_SWATCH = 'savu'

const auth = useAuth()
const { isDark } = useTheme()

const initials = computed(() =>
  (auth.name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join(''),
)
</script>

<template>
  <!-- Päänäkymien yläpalkki: logosta päiväkirjaan, oikealla synkan tila ja pallo, josta asetukset aukeavat. -->
  <header class="flex min-h-11 items-center justify-between gap-3 px-5 pt-6">
    <RouterLink to="/" aria-label="Treenis, päiväkirjaan" class="-m-1.5 rounded-[6px] p-1.5">
      <AppLogo class="h-[26px] w-auto text-brand" aria-hidden="true" />
    </RouterLink>
    <div class="flex items-center gap-2">
      <SyncBadge />
      <RouterLink
        to="/asetukset"
        aria-label="Asetukset"
        :style="sportVars(SWATCHES_BY_ID[AVATAR_SWATCH], isDark)"
        class="flex size-11 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[15px] font-bold text-[var(--sport-on)]"
      >
        <span v-if="initials" aria-hidden="true">{{ initials }}</span>
        <!-- Ilman nimeä pallossa on henkilö, ettei se ole tyhjä. -->
        <svg
          v-else
          class="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="8.5" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      </RouterLink>
    </div>
  </header>
</template>
