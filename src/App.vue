<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'
import { useRestAlarm } from '@/composables/useRestAlarm'

const route = useRoute()

useRestAlarm()
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-[env(safe-area-inset-top)]"
  >
    <main class="flex-1 pb-3">
      <AppHeader v-if="route.meta.header" />
      <!-- Sivu vaihtuu heti ilman häivytystä: häivytys näytti välähdykseltä, kun vanha sivu ehti kadota ensin. -->
      <RouterView />
    </main>
    <AppNav v-if="!route.meta.hideNav" />
  </div>
</template>
