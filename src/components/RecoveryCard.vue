<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatClock } from '@/lib/format'
import { useSession } from '@/stores/session'

const session = useSession()
const router = useRouter()

/** Hylkääminen poistaa kirjatut sarjat, joten se vahvistetaan erikseen. */
const confirming = ref(false)

async function discard() {
  await session.discard()
  confirming.value = false
}
</script>

<template>
  <section
    v-if="session.recovery"
    aria-labelledby="recovery-title"
    class="rounded-(--radius-feature) border-2 border-line bg-surface p-4"
  >
    <h2 id="recovery-title" class="text-base font-bold tracking-[-0.01em]">
      {{ session.recovery.title }} jäi kesken
    </h2>
    <p class="mt-1 text-[13px] text-ink-muted" data-numeric>
      {{ session.recovery.done }} / {{ session.recovery.total }} sarjaa tehty · aloitettu klo
      {{ formatClock(session.recovery.startedAt) }}
    </p>

    <div v-if="!confirming" class="mt-3 flex gap-2">
      <button
        type="button"
        class="min-h-11 flex-1 rounded-(--radius-button) bg-action text-sm font-semibold text-on-action"
        @click="router.push('/treeni')"
      >
        Jatka
      </button>
      <button
        type="button"
        class="min-h-11 flex-1 rounded-(--radius-button) border border-line text-sm font-semibold"
        @click="confirming = true"
      >
        Hylkää
      </button>
    </div>

    <div v-else class="mt-3">
      <p class="text-[13px]">Kirjatut sarjat poistetaan. Hylätäänkö treeni?</p>
      <div class="mt-2 flex gap-2">
        <button
          type="button"
          class="min-h-11 flex-1 rounded-(--radius-button) bg-action text-sm font-semibold text-on-action"
          @click="discard"
        >
          Hylkää treeni
        </button>
        <button
          type="button"
          class="min-h-11 flex-1 rounded-(--radius-button) border border-line text-sm font-semibold"
          @click="confirming = false"
        >
          Peruuta
        </button>
      </div>
    </div>
  </section>
</template>
