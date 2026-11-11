<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import { useAuth } from '@/stores/auth'
import { useStrava } from '@/stores/strava'
import { useSync } from '@/stores/sync'

const route = useRoute()
const router = useRouter()
const auth = useAuth()
const strava = useStrava()
const sync = useSync()

const status = ref<'working' | 'done' | 'failed'>('working')
const message = ref('')

// Paluu Stravalta. iPhonen kotivalikkosovelluksessa tämä sivu voi aueta
// Safarissa, jossa käyttäjä ei ole kirjautunut. Palvelin tunnistaa käyttäjän
// state-tunnisteesta, joten yhdistäminen onnistuu silti.
onMounted(async () => {
  const { code, state, scope, error } = route.query
  if (error || typeof code !== 'string' || typeof state !== 'string') {
    status.value = 'failed'
    message.value = error === 'access_denied' ? 'Yhdistäminen peruttiin.' : 'Stravalta palattiin ilman lupaa.'
    return
  }
  try {
    const result = await strava.finishConnect(code, state, typeof scope === 'string' ? scope : '')
    status.value = 'done'
    message.value =
      result.imported === 1 ? 'Tuotiin 1 aktiviteetti.' : `Tuotiin ${result.imported} aktiviteettia.`
    if (auth.userId) void sync.run()
  } catch (e) {
    status.value = 'failed'
    message.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="flex min-h-dvh flex-col justify-center gap-4 px-5 pb-[20vh]">
    <AppLogo class="block h-8 w-auto self-start text-brand" />

    <div role="status">
      <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">
        <template v-if="status === 'working'">Yhdistetään Stravaa…</template>
        <template v-else-if="status === 'done'">Strava yhdistetty</template>
        <template v-else>Yhdistäminen ei onnistunut</template>
      </h1>
      <p v-if="message" class="mt-2 text-[15px] text-ink-muted">{{ message }}</p>
    </div>

    <template v-if="status !== 'working'">
      <button
        v-if="auth.userId"
        type="button"
        class="min-h-13 rounded-(--radius-button) bg-action text-base font-semibold text-on-action"
        @click="router.replace(status === 'done' ? '/' : '/asetukset/ulkoasu')"
      >
        {{ status === 'done' ? 'Päiväkirjaan' : 'Takaisin asetuksiin' }}
      </button>
      <!-- Safarissa ilman kirjautumista: yhteys on palvelimella, joten sovellukseen voi vain palata. -->
      <p v-else class="text-[15px]">Voit sulkea tämän välilehden ja palata Treenikseen.</p>
    </template>
  </div>
</template>
