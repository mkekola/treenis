<script setup lang="ts">
import AppNav from '@/components/AppNav.vue'
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-[env(safe-area-inset-top)]"
  >
    <main class="flex-1 pb-3">
      <RouterView />
    </main>
    <AppNav />
  </div>
</template>
