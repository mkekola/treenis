<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppNav from '@/components/AppNav.vue'

const route = useRoute()
const router = useRouter()

// Takaisin pyyhkäistessä iOS liu'uttaa jo oman kuvansa edellisestä sivusta. Jos sivu
// sen jälkeen vielä häivytetään esiin, se välähtää. Selaimen takaisin- ja
// eteenpäin-siirtymät (tyyppi 'pop') näytetään siksi heti, sovelluksen omat linkit
// pehmeästi kuten ennen.
const instant = ref(false)
let popped = false
router.options.history.listen((_to, _from, info) => {
  popped = info.type === 'pop'
})
router.beforeEach(() => {
  instant.value = popped
  popped = false
})
</script>

<template>
  <div
    class="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col pt-[env(safe-area-inset-top)]"
  >
    <main class="flex-1 pb-3">
      <AppHeader v-if="route.meta.header" />
      <!-- Uusi näkymä liukuu rauhallisesti esiin. Vanha poistuu heti, jotta siirtymä ei hidasta käyttöä. -->
      <RouterView v-slot="{ Component }">
        <Transition :name="instant ? 'instant' : 'page'" mode="out-in" :duration="{ enter: instant ? 0 : 180, leave: 0 }">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
    <AppNav v-if="!route.meta.hideNav" />
  </div>
</template>
