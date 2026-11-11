<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '@/stores/auth'
import { useSession } from '@/stores/session'
import { useSync } from '@/stores/sync'

const auth = useAuth()
const session = useSession()
const sync = useSync()

const confirming = ref(false)
const busy = ref(false)

const unsent = computed(() =>
  sync.pending === 1 ? '1 muutos on' : `${sync.pending} muutosta on`,
)

async function signOut() {
  busy.value = true
  await auth.signOut()
}
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Tili</h2>
    <p v-if="auth.email" class="mt-2 text-[15px]">{{ auth.email }}</p>

    <!-- Lähettämätön data jäisi vain tälle laitteelle ja katoaisi uloskirjautuessa. -->
    <p v-if="session.active" class="mt-2 text-[13px] text-ink-muted">
      Treeni on kesken. Päätä se ensin, jotta se ei katoa uloskirjautuessa.
    </p>

    <template v-else-if="sync.pending > 0">
      <p class="mt-2 text-[13px] text-ink-muted">
        {{ unsent }} vielä lähettämättä. Uloskirjautuminen onnistuu, kun ne ovat palvelimella.
      </p>
      <button
        type="button"
        class="mt-3 min-h-11 w-full rounded-(--radius-button) border border-line font-semibold"
        @click="sync.run()"
      >
        Lähetä nyt
      </button>
    </template>

    <template v-else-if="confirming">
      <p class="mt-2 text-[13px]">
        Treenit poistetaan tältä laitteelta. Ne ovat tallessa ja palaavat, kun kirjaudut uudelleen.
      </p>
      <div class="mt-3 flex gap-2">
        <button
          type="button"
          class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
          @click="confirming = false"
        >
          Peruuta
        </button>
        <button
          type="button"
          :disabled="busy"
          class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-60"
          @click="signOut"
        >
          Kirjaudu ulos
        </button>
      </div>
    </template>

    <button
      v-else
      type="button"
      class="mt-3 min-h-11 w-full rounded-(--radius-button) border border-line font-semibold"
      @click="confirming = true"
    >
      Kirjaudu ulos
    </button>
  </section>
</template>
