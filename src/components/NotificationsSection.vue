<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { isStandalone } from '@/lib/push'
import { useNotifications, type NotificationSettings } from '@/stores/notifications'

const notifications = useNotifications()
const message = ref('')
const busy = ref(false)
const standalone = isStandalone()

onMounted(async () => {
  try {
    await notifications.load()
  } catch {
    message.value = 'Ilmoitusasetukset tarvitsevat verkkoyhteyden.'
  }
})

const OPTIONS: { key: keyof NotificationSettings; label: string; hint: string }[] = [
  { key: 'friend_requests', label: 'Kaveripyynnöt', hint: 'Uusi pyyntö ja hyväksytty pyyntö' },
  { key: 'reactions', label: 'Reaktiot', hint: 'Kun joku reagoi treeniisi' },
  { key: 'challenges', label: 'Haasteet', hint: 'Kutsu, 2 päivää jäljellä ja lopputulos' },
  { key: 'streak', label: 'Viikkoputki', hint: 'Lauantaina, jos viikolla on alle 2 treeniä' },
]

async function enable() {
  busy.value = true
  message.value = ''
  try {
    const result = await notifications.enable()
    if (result === 'denied') {
      message.value = 'Ilmoitukset on estetty. Salli ne puhelimen asetuksista (Ilmoitukset → Treenis).'
    }
  } catch {
    message.value = 'Ilmoitusten käyttöönotto ei onnistunut. Tarkista verkkoyhteys.'
  } finally {
    busy.value = false
  }
}

async function disable() {
  busy.value = true
  try {
    await notifications.disable()
  } finally {
    busy.value = false
  }
}

async function sendTest() {
  busy.value = true
  message.value = ''
  try {
    const sent = await notifications.sendTest()
    message.value = sent ? 'Testi-ilmoitus lähetetty.' : 'Laitetta ei löytynyt. Ota ilmoitukset uudelleen käyttöön.'
  } catch {
    message.value = 'Testi-ilmoitus ei lähtenyt. Tarkista verkkoyhteys.'
  } finally {
    busy.value = false
  }
}

async function toggle(key: keyof NotificationSettings) {
  if (!notifications.settings) return
  message.value = ''
  try {
    await notifications.save({ ...notifications.settings, [key]: !notifications.settings[key] })
  } catch {
    message.value = 'Muutos ei tallentunut. Tarkista verkkoyhteys.'
  }
}
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Ilmoitukset</h2>

    <p v-if="!notifications.supported" class="mt-2 text-[13px] text-ink-muted">
      {{
        standalone
          ? 'Tämä laite ei tue ilmoituksia.'
          : 'Ilmoitukset toimivat, kun Treenis on lisätty kotivalikkoon. iPhonessa: Safari → Jaa → Lisää Koti-valikkoon.'
      }}
    </p>

    <template v-else-if="!notifications.enabled">
      <p class="mt-2 text-[13px] text-ink-muted">
        Kaveripyynnöt, reaktiot, haasteet ja viikkoputken muistutus. Voit valita tyypit käyttöönoton jälkeen.
      </p>
      <button
        type="button"
        :disabled="busy"
        class="mt-3 min-h-11 w-full rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-60"
        @click="enable"
      >
        Ota ilmoitukset käyttöön
      </button>
    </template>

    <template v-else>
      <ul v-if="notifications.settings" class="mt-1">
        <li v-for="option in OPTIONS" :key="option.key" class="border-t border-line first:border-t-0">
          <label class="flex min-h-14 items-center gap-3 py-2">
            <span class="min-w-0 flex-1">
              <span class="block text-[15px]">{{ option.label }}</span>
              <span class="block text-[13px] text-ink-muted">{{ option.hint }}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              :checked="notifications.settings[option.key]"
              class="peer sr-only"
              @change="toggle(option.key)"
            />
            <span
              aria-hidden="true"
              class="relative h-[26px] w-11 flex-none rounded-full bg-track transition-colors peer-checked:bg-action peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink after:absolute after:top-[3px] after:left-[3px] after:size-5 after:rounded-full after:bg-bg after:transition-transform peer-checked:after:translate-x-[18px] peer-checked:after:bg-on-action motion-reduce:transition-none motion-reduce:after:transition-none"
            />
          </label>
        </li>
      </ul>
      <button
        type="button"
        :disabled="busy"
        class="mt-2 min-h-11 w-full rounded-(--radius-button) border border-line font-semibold disabled:opacity-60"
        @click="sendTest"
      >
        Lähetä testi-ilmoitus
      </button>
      <button
        type="button"
        :disabled="busy"
        class="mt-1 min-h-11 text-sm font-semibold text-ink-muted underline"
        @click="disable"
      >
        Poista ilmoitukset käytöstä tällä laitteella
      </button>
    </template>

    <p v-if="message" role="status" class="mt-2 text-[13px] font-semibold">{{ message }}</p>
  </section>
</template>
