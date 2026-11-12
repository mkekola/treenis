<!--
  Kaavion luvut avattavana taulukkona. Selaimen oma <details> toimii valmiiksi
  näppäimistöllä ja ruudunlukijalla. Suljettuna se ei vie tilaa.
-->
<template>
  <details class="group mt-2.5 border-t border-line pt-1">
    <summary
      class="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-ink-muted [&::-webkit-details-marker]:hidden"
    >
      <span class="group-open:hidden">Näytä luvut</span>
      <span class="hidden group-open:inline">Piilota luvut</span>
      <svg
        class="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <polyline points="6,9 12,15 18,9" />
      </svg>
    </summary>
    <slot />
  </details>
</template>
