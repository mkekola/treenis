<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useFriends, type ShareSettings } from '@/stores/friends'

const friends = useFriends()
const message = ref('')

onMounted(async () => {
  try {
    await friends.loadShare()
  } catch {
    message.value = 'Asetukset tarvitsevat verkkoyhteyden.'
  }
})

const OPTIONS: { key: keyof ShareSettings; label: string; hint: string }[] = [
  { key: 'workouts', label: 'Treenit', hint: 'Laji ja treenin nimi, esim. "Sali · Treeni 1"' },
  { key: 'records', label: 'Ennätykset', hint: 'Liike ja uusi paino' },
  { key: 'exercises', label: 'Liikkeet ja sarjat', hint: 'Liikkeet, sarjamäärät ja raskain paino' },
]

async function toggle(key: keyof ShareSettings) {
  if (!friends.share) return
  message.value = ''
  try {
    await friends.saveShare({ ...friends.share, [key]: !friends.share[key] })
  } catch {
    message.value = 'Muutos ei tallentunut. Tarkista verkkoyhteys.'
  }
}
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Kaverit näkevät</h2>
    <ul v-if="friends.share" class="mt-1">
      <li v-for="option in OPTIONS" :key="option.key" class="border-t border-line first:border-t-0">
        <!-- Ennätykset ja liikkeet näkyvät vain treenien mukana. -->
        <label
          class="flex min-h-14 items-center gap-3 py-2"
          :class="option.key !== 'workouts' && !friends.share.workouts ? 'opacity-50' : ''"
        >
          <span class="min-w-0 flex-1">
            <span class="block text-[15px]">{{ option.label }}</span>
            <span class="block text-[13px] text-ink-muted">{{ option.hint }}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            :checked="friends.share[option.key]"
            :disabled="option.key !== 'workouts' && !friends.share.workouts"
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
    <p class="mt-2 text-[13px] text-ink-muted">
      Muistiinpanot eivät näy kenellekään. Stravasta tuodut treenit näkyvät vain sinulle.
    </p>
    <p v-if="message" role="status" class="mt-1 text-[13px] font-semibold">{{ message }}</p>
  </section>
</template>
