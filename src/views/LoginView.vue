<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import { useNow } from '@/composables/useNow'
import { formatDuration } from '@/lib/format'
import { CODE_COOLDOWN_SEC, retryAfterSec } from '@/lib/otp'
import { useAuth } from '@/stores/auth'

const auth = useAuth()
const router = useRouter()

// Vain kehityksessä. Tuotannossa ehto on aina epätosi, joten build jättää
// komponentin kokonaan pois eikä nappia ole olemassa.
const DevSkipLogin = import.meta.env.DEV
  ? defineAsyncComponent(() => import('@/components/DevSkipLogin.vue'))
  : null

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const busy = ref(false)
const error = ref('')
const notice = ref('')
const codeInput = useTemplateRef<HTMLInputElement>('codeInput')

// Uuden koodin nappi odottaa Supabasen minuutin rajan, jottei pyyntö kaadu virheeseen.
const now = useNow()
const cooldownUntil = ref(0)
const cooldownSec = computed(() => Math.max(0, Math.ceil((cooldownUntil.value - now.value) / 1000)))

function startCooldown(seconds: number) {
  // now päivittyy vain kerran sekunnissa, joten tuoreutetaan se, ettei laskuri ala sekunnin liian suurena.
  now.value = Date.now()
  cooldownUntil.value = now.value + seconds * 1000
}

function message(err: unknown): string {
  const wait = retryAfterSec(err)
  if (wait) return `Uuden koodin voi pyytää ${wait} sekunnin päästä.`
  const { code: errorCode, name } = (err ?? {}) as { code?: string; name?: string }
  if (name === 'AuthRetryableFetchError' || !navigator.onLine) {
    return 'Ei verkkoyhteyttä. Kirjautuminen tarvitsee verkon kerran, sen jälkeen Treenis toimii ilmankin.'
  }
  if (errorCode === 'otp_disabled' || errorCode === 'signup_disabled') {
    return 'Tällä osoitteella ei ole kutsua Treenikseen.'
  }
  if (errorCode === 'otp_expired') return 'Koodi on väärä tai vanhentunut.'
  if (errorCode?.startsWith('over_')) return 'Liian monta yritystä. Odota hetki ja kokeile uudelleen.'
  return 'Jokin meni pieleen. Kokeile uudelleen.'
}

async function sendCode() {
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    await auth.sendCode(email.value.trim())
    startCooldown(CODE_COOLDOWN_SEC)
    step.value = 'code'
    code.value = ''
    await nextTick()
    codeInput.value?.focus()
  } catch (err) {
    const wait = retryAfterSec(err)
    if (wait) startCooldown(wait)
    error.value = message(err)
  } finally {
    busy.value = false
  }
}

async function resend() {
  await sendCode()
  if (!error.value) notice.value = 'Uusi koodi lähetetty.'
}

async function verify() {
  busy.value = true
  error.value = ''
  try {
    await auth.verifyCode(email.value.trim(), code.value.replace(/\D/g, ''))
    await router.replace('/')
  } catch (err) {
    error.value = message(err)
  } finally {
    busy.value = false
  }
}

function changeEmail() {
  step.value = 'email'
  error.value = ''
  notice.value = ''
}
</script>

<template>
  <div class="flex min-h-dvh flex-col justify-center gap-6 px-5 pb-[20vh]">
    <header>
      <h1><AppLogo class="block h-10 w-auto text-brand" /></h1>
      <p class="mt-3.5 text-[15px] text-ink-muted">
        Kirjaudu kerran tällä laitteella. Sen jälkeen treenit kulkevat mukana myös ilman verkkoa.
      </p>
    </header>

    <form v-if="step === 'email'" class="flex flex-col gap-3" @submit.prevent="sendCode">
      <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Sähköposti
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="mt-1 block h-12 w-full rounded-(--radius-field) border border-line bg-surface px-3.5 text-base font-normal tracking-normal text-ink normal-case"
        />
      </label>
      <button
        type="submit"
        :disabled="busy"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-60"
      >
        {{ busy ? 'Lähetetään…' : 'Lähetä koodi' }}
      </button>
    </form>

    <form v-else class="flex flex-col gap-3" @submit.prevent="verify">
      <p class="text-[15px]">
        Lähetimme koodin osoitteeseen <strong class="font-semibold">{{ email.trim() }}</strong>.
      </p>
      <label class="text-xs font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Koodi
        <input
          ref="codeInput"
          v-model="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          pattern="[0-9 ]{6,11}"
          required
          class="mt-1 block h-14 w-full rounded-(--radius-field) border border-line bg-surface px-3.5 font-display text-2xl font-semibold tracking-[0.3em] text-ink tabular-nums"
        />
      </label>
      <button
        type="submit"
        :disabled="busy"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-60"
      >
        {{ busy ? 'Tarkistetaan…' : 'Kirjaudu' }}
      </button>
      <div class="flex justify-between">
        <button type="button" class="min-h-11 text-sm font-semibold underline" @click="changeEmail">
          Vaihda osoite
        </button>
        <button
          type="button"
          :disabled="busy || cooldownSec > 0"
          class="min-h-11 text-sm font-semibold underline tabular-nums disabled:no-underline disabled:opacity-60"
          @click="resend"
        >
          {{ cooldownSec ? `Uusi koodi ${formatDuration(cooldownSec)}` : 'Lähetä uusi koodi' }}
        </button>
      </div>
    </form>

    <p v-if="error" role="alert" class="text-[15px] font-semibold">{{ error }}</p>
    <p v-else-if="notice" role="status" class="text-[15px] text-ink-muted">{{ notice }}</p>

    <RouterLink to="/tietosuoja" class="inline-flex min-h-11 items-center self-start text-sm text-ink-muted underline">Tietosuoja</RouterLink>

    <DevSkipLogin v-if="DevSkipLogin" />
  </div>
</template>
