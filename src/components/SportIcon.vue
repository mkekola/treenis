<script setup lang="ts">
import { computed } from 'vue'
import type { SportKey } from '@/types/workout'

const props = withDefaults(defineProps<{ sport: SportKey; size?: number }>(), { size: 30 })

/**
 * Ikonit luetaan suoraan SVG-tiedostoista, jolloin tiedosto on ainoa totuus:
 * ikonin vaihtaminen on tiedoston korvaamista, ei koodin muokkaamista.
 * Tiedoston nimi on lajin tunnus, esim. swim.svg.
 */
const files = import.meta.glob('../assets/icons/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const INNER: Partial<Record<SportKey, string>> = {}
for (const [path, source] of Object.entries(files)) {
  const key = path.split('/').pop()!.replace('.svg', '') as SportKey
  INNER[key] = source.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
}

const markup = computed(() => INNER[props.sport] ?? INNER.other ?? '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 100 100"
    fill="currentColor"
    aria-hidden="true"
    v-html="markup"
  />
</template>
