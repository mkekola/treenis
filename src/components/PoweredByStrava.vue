<script setup lang="ts">
import black from '@/assets/strava/powered-by-strava-black.svg'
import white from '@/assets/strava/powered-by-strava-white.svg'
import { useTheme } from '@/composables/useTheme'

const { isDark } = useTheme()
</script>

<!-- Stravan brändiohjeet: merkki näkyy siellä, missä Strava-dataa näytetään. Väri seuraa teemaa. -->
<template>
  <img :src="isDark ? white : black" alt="Powered by Strava" class="block h-[18px] w-auto" />
</template>
