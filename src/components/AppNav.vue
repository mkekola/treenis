<script setup lang="ts">
const items = [
  { to: '/', label: 'Päiväkirja' },
  { to: '/tilastot', label: 'Tilastot' },
  { to: '/asetukset/ulkoasu', label: 'Asetukset' },
] as const
</script>

<template>
  <nav
    aria-label="Päävalikko"
    class="grid grid-cols-3 gap-1 border-t border-line bg-bg px-5 pt-2.5 pb-[max(1rem,env(safe-area-inset-bottom))]"
  >
    <RouterLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="flex flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-ink-muted"
      active-class="font-semibold text-ink"
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
        v-else-if="item.to === '/tilastot'"
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
        <circle cx="12" cy="12" r="3.2" />
        <path
          d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2L5.6 5.6"
        />
      </svg>
      {{ item.label }}
    </RouterLink>
  </nav>
</template>
