<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatClock, formatShortDate } from '@/lib/format'
import { localDate } from '@/lib/session'
import { useStrava } from '@/stores/strava'
import { useSync } from '@/stores/sync'

const strava = useStrava()
const sync = useSync()

const loading = ref(true)
const busy = ref(false)
const confirming = ref(false)
const message = ref('')

onMounted(async () => {
  try {
    await strava.loadStatus()
  } catch {
    message.value = 'Strava-yhteyden tilaa ei saatu. Tarkista verkkoyhteys.'
  } finally {
    loading.value = false
  }
})

/** "ke 12.11. klo 17.28" */
const when = (iso: string) => `${formatShortDate(localDate(new Date(iso)))} klo ${formatClock(iso)}`

async function attempt(action: () => Promise<void>) {
  busy.value = true
  message.value = ''
  try {
    await action()
  } catch (error) {
    message.value = error instanceof Error ? error.message : String(error)
  } finally {
    busy.value = false
  }
}

const connect = () => attempt(() => strava.connect())

const importNow = () =>
  attempt(async () => {
    await strava.importNow()
    await sync.run()
    message.value = 'Haettu.'
  })

const disconnect = () =>
  attempt(async () => {
    await strava.disconnect()
    confirming.value = false
    message.value = 'Yhteys katkaistu. Päiväkirjan treenit jäivät ennalleen.'
  })
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Strava</h2>

    <p v-if="loading" class="mt-2 text-[13px] text-ink-muted">Tarkistetaan yhteyttä…</p>

    <template v-else-if="!strava.connected">
      <p class="mt-2 text-[13px] text-ink-muted">
        Kellon mittaamat treenit tulevat päiväkirjaan Stravan kautta: kesto, syke ja matka.
        Treenis vain lukee, eikä kirjoita Stravaan mitään.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="mt-3 min-h-11 w-full rounded-(--radius-button) bg-action px-4 font-semibold text-on-action disabled:opacity-40"
        @click="connect"
      >
        Yhdistä Strava
      </button>
    </template>

    <template v-else>
      <p class="mt-2 text-[15px]">Yhdistetty {{ when(strava.connectedAt!) }}</p>
      <p v-if="strava.lastImportAt" class="text-[13px] text-ink-muted">
        Viimeksi haettu {{ when(strava.lastImportAt) }}
      </p>

      <div v-if="!confirming" class="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          :disabled="busy"
          class="min-h-11 rounded-(--radius-button) border border-line text-[15px] font-semibold disabled:opacity-40"
          @click="importNow"
        >
          Hae nyt
        </button>
        <button
          type="button"
          :disabled="busy"
          class="min-h-11 rounded-(--radius-button) border border-line text-[15px] font-semibold disabled:opacity-40"
          @click="confirming = true"
        >
          Katkaise
        </button>
      </div>

      <div v-else class="mt-3">
        <p class="text-[13px]">
          Katkaistaanko yhteys? Tuodut aktiviteetit poistetaan, mutta päiväkirjan treenit jäävät.
        </p>
        <div class="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            class="min-h-11 rounded-(--radius-button) border border-line text-[15px] font-semibold"
            @click="confirming = false"
          >
            Peruuta
          </button>
          <button
            type="button"
            :disabled="busy"
            class="min-h-11 rounded-(--radius-button) bg-action text-[15px] font-semibold text-on-action disabled:opacity-40"
            @click="disconnect"
          >
            Katkaise
          </button>
        </div>
      </div>
    </template>

    <p v-if="message" role="status" class="mt-2 text-[13px] text-ink-muted">{{ message }}</p>
  </section>
</template>
