<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useRoute } from 'vue-router'
import AccountSection from '@/components/AccountSection.vue'
import DataExportSection from '@/components/DataExportSection.vue'
import IconCreditsSection from '@/components/IconCreditsSection.vue'
import NotificationsSection from '@/components/NotificationsSection.vue'
import ShareSettingsSection from '@/components/ShareSettingsSection.vue'
import SportColorsSection from '@/components/SportColorsSection.vue'
import StravaSection from '@/components/StravaSection.vue'
import ThemeSection from '@/components/ThemeSection.vue'
import { SETTINGS_PAGES, type SettingsPageKey } from '@/design/settingsPages'

const route = useRoute()

const SECTIONS: Record<SettingsPageKey, Component> = {
  ulkoasu: ThemeSection,
  'lajien-varit': SportColorsSection,
  kaverit: ShareSettingsSection,
  ilmoitukset: NotificationsSection,
  strava: StravaSection,
  tiedot: DataExportSection,
  tili: AccountSection,
  ikonit: IconCreditsSection,
}

const key = computed(() => String(route.params.osio) as SettingsPageKey)
const title = computed(() =>
  key.value === 'ikonit' ? 'Ikonien tekijät' : (SETTINGS_PAGES.find((p) => p.key === key.value)?.title ?? 'Asetukset'),
)
const section = computed(() => SECTIONS[key.value])
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <RouterLink
      to="/asetukset"
      aria-label="Takaisin asetuksiin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">{{ title }}</h1>

    <component :is="section" v-if="section" />
    <p v-else class="text-[15px] text-ink-muted">Sivua ei löytynyt.</p>
  </div>
</template>
