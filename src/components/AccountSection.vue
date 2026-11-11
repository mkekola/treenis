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

// ------------------------------------------------------------------- nimi

const nameText = ref(auth.name ?? '')
const savingName = ref(false)
const nameMessage = ref('')
const nameChanged = computed(() => nameText.value.trim() !== '' && nameText.value.trim() !== auth.name)

async function saveName() {
  savingName.value = true
  nameMessage.value = ''
  try {
    await auth.setName(nameText.value)
    nameMessage.value = 'Tallennettu.'
  } catch {
    nameMessage.value = 'Nimen tallennus tarvitsee verkon. Kokeile uudelleen.'
  } finally {
    savingName.value = false
  }
}

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

    <form class="mt-3" @submit.prevent="saveName">
      <label for="tilin-nimi" class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Nimi
      </label>
      <p id="tilin-nimi-ohje" class="text-[13px] text-ink-muted">Näkyy päiväkirjan tervehdyksessä.</p>
      <div class="mt-1 flex gap-2">
        <input
          id="tilin-nimi"
          v-model="nameText"
          type="text"
          autocomplete="given-name"
          aria-describedby="tilin-nimi-ohje"
          class="h-11 min-w-0 flex-1 rounded-(--radius-field) border border-line bg-bg px-3 text-base"
        />
        <button
          type="submit"
          :disabled="!nameChanged || savingName"
          class="min-h-11 rounded-(--radius-button) bg-action px-4 font-semibold text-on-action disabled:opacity-40"
        >
          Tallenna
        </button>
      </div>
      <p v-if="nameMessage" role="status" class="mt-1 text-[13px] text-ink-muted">{{ nameMessage }}</p>
    </form>

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
