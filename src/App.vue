<script setup lang="ts">
import { useRoute } from 'vue-router'
import AppNav from '@/components/AppNav.vue'

const route = useRoute()
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-[env(safe-area-inset-top)]"
  >
    <main class="flex-1 pb-3">
      <!-- Uusi näkymä liukuu rauhallisesti esiin. Vanha poistuu heti, jotta siirtymä ei hidasta käyttöä. -->
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in" :duration="{ enter: 180, leave: 0 }">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <AppNav v-if="!route.meta.hideNav" />
  </div>
</template>
