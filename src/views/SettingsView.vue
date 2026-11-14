<script setup lang="ts">
import { SETTINGS_PAGES } from '@/design/settingsPages'
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <RouterLink
      to="/"
      aria-label="Takaisin päiväkirjaan"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Asetukset</h1>

    <nav aria-label="Asetukset">
      <ul class="rounded-(--radius-feature) bg-surface px-4 py-1">
        <li v-for="page in SETTINGS_PAGES" :key="page.key" class="border-t border-line first:border-t-0">
          <RouterLink :to="`/asetukset/${page.key}`" class="flex min-h-15 items-center gap-3 py-2.5">
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-semibold">{{ page.title }}</span>
              <span class="block truncate text-[13px] text-ink-muted">{{ page.hint }}</span>
            </span>
            <svg class="size-4 flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="9,5 16,12 9,19" />
            </svg>
          </RouterLink>
        </li>
      </ul>
    </nav>

    <div class="flex gap-4">
      <RouterLink to="/tietosuoja" class="inline-flex min-h-11 items-center text-sm text-ink-muted underline">Tietosuoja</RouterLink>
      <RouterLink to="/asetukset/ikonit" class="inline-flex min-h-11 items-center text-sm text-ink-muted underline">
        Ikonien tekijät
      </RouterLink>
    </div>
  </div>
</template>
