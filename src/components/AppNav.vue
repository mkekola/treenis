<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

const items = [
  { to: '/', label: 'Päiväkirja' },
  { to: '/ohjelmat', label: 'Ohjelmat' },
  { to: '/tilastot', label: 'Tilastot' },
  { to: '/kaverit', label: 'Kaverit' },
] as const

/** Ohjelman ja treenin muokkaus (/ohjelmat/…) kuuluvat Ohjelmat-välilehteen. */
const isActive = (to: string) => (to === '/' ? route.path === '/' : route.path.startsWith(to))
</script>

<template>
  <nav
    aria-label="Päävalikko"
    class="sticky bottom-0 z-10 grid grid-cols-4 gap-1 border-t border-line bg-bg px-5 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]"
  >
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex flex-col items-center gap-0.5 py-1.5 text-[11px]"
      :class="isActive(item.to) ? 'font-semibold text-ink' : 'font-medium text-ink-muted'"
      :aria-current="isActive(item.to) ? 'page' : undefined"
    >
      <svg
        v-if="item.to === '/'"
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z" />
        <line x1="9" y1="9" x2="15" y2="9" />
      </svg>
      <svg
        v-else-if="item.to === '/ohjelmat'"
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4V3h6v1" />
        <line x1="9" y1="10" x2="15" y2="10" />
        <line x1="9" y1="14" x2="15" y2="14" />
        <line x1="9" y1="18" x2="12" y2="18" />
      </svg>
      <svg
        v-else-if="item.to === '/kaverit'"
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="9" cy="8" r="3.5" />
        <path d="M3 20a6 6 0 0 1 12 0" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
        <path d="M18 14.4a6 6 0 0 1 3 5.6" />
      </svg>
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
        <line x1="6" y1="20" x2="6" y2="12" />
        <line x1="12" y1="20" x2="12" y2="5" />
        <line x1="18" y1="20" x2="18" y2="9" />
      </svg>
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
