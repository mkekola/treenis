<script setup lang="ts">
import { ICON_CREATOR, ICON_CREDITS } from '@/design/iconCredits'
</script>

<template>
  <!-- Noun Projectin ilmainen lisenssi vaatii tekijämaininnan. -->
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Ikonit</h2>
    <p class="mt-2 text-[13px]">
      Lajien ikonit ovat {{ ICON_CREATOR }}'n piirtämiä, Noun Projectista.
    </p>
    <ul class="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 text-xs text-ink-muted">
      <li v-for="(credit, index) in ICON_CREDITS" :key="credit.sport">
        <a :href="credit.url" target="_blank" rel="noopener" class="underline">{{
          credit.iconName
        }}</a
        ><span v-if="index < ICON_CREDITS.length - 1">,</span>
      </li>
    </ul>
    <p class="mt-2 text-xs text-ink-muted">by {{ ICON_CREATOR }} from Noun Project</p>
  </section>
</template>
