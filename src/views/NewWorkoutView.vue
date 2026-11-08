<script setup lang="ts"></script>

<template>
  <div class="flex min-h-full flex-col gap-3 px-5 pt-6">
    <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">
      Kirjaa treeni
    </h1>
    <p class="text-[13px] text-ink-muted">
      Tämä näkymä on seuraava työvaihe: salitreenin kirjaus liikkeineen ja sarjoineen sekä
      juoksun käsinkirjaus. Suunnittelu on vielä kesken.
    </p>
    <RouterLink
      to="/"
      class="mt-2 flex min-h-12 items-center justify-center rounded-(--radius-button) border border-line font-semibold"
    >
      Takaisin päiväkirjaan
    </RouterLink>
  </div>
</template>
