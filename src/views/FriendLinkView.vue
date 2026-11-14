<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import { formatFriendCode, parseFriendCode } from '@/lib/friends'

// iPhonessa viestistä avattu linkki aukeaa Safarissa, jossa ei olla kirjautuneena.
// Siksi sivu näyttää koodin, jonka voi liittää kotivalikon Treenikseen.
const route = useRoute()
const code = computed(() => parseFriendCode(String(route.params.code ?? '')))
const copied = ref('')

async function copy() {
  if (!code.value) return
  try {
    await navigator.clipboard.writeText(formatFriendCode(code.value))
    copied.value = 'Koodi kopioitu.'
  } catch {
    copied.value = 'Kopiointi ei onnistunut. Kirjoita koodi käsin.'
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col justify-center gap-6 px-5 pb-[20vh]">
    <AppLogo class="block h-10 w-auto self-start text-brand" />

    <template v-if="code">
      <div>
        <h1 class="font-display text-[26px] leading-[1.1] font-bold tracking-[-0.02em]">Kaveripyyntö Treeniksessä</h1>
        <p class="mt-2 text-[15px] text-ink-muted">Liitä tämä koodi Treeniksen Kaverit-välilehdellä kohtaan Lisää kaveri.</p>
      </div>
      <div class="rounded-(--radius-feature) bg-surface p-4">
        <p class="font-display text-[40px] leading-none font-bold tracking-[0.06em] tabular-nums">
          {{ formatFriendCode(code) }}
        </p>
        <button
          type="button"
          class="mt-4 min-h-12 w-full rounded-(--radius-button) bg-action font-semibold text-on-action"
          @click="copy"
        >
          Kopioi koodi
        </button>
        <p v-if="copied" role="status" class="mt-2 text-[13px]">{{ copied }}</p>
      </div>
      <p class="text-[13px] text-ink-muted">
        Treenis on vain kutsutuille. Jos sinulla ei vielä ole tiliä, pyydä kutsu kaveriltasi.
      </p>
    </template>

    <p v-else class="text-[15px]">Linkistä puuttuu kaverikoodi. Pyydä kaveriltasi uusi linkki.</p>
  </div>
</template>
