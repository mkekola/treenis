<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { formatFriendCode, parseFriendCode } from '@/lib/friends'
import { useAuth } from '@/stores/auth'
import { useFriends, type RequestResult } from '@/stores/friends'

const auth = useAuth()
const friends = useFriends()
const route = useRoute()

const OFFLINE = 'Kaverit tarvitsevat verkkoyhteyden. Kokeile uudelleen.'

const loadError = ref('')
const busy = ref(false)
const lists = computed(() => friends.lists)

async function load() {
  loadError.value = ''
  try {
    await friends.load()
  } catch {
    loadError.value = OFFLINE
  }
}

onMounted(load)

// ------------------------------------------------------------ kaverin lisäys

// Kaverilinkistä tultaessa koodi on valmiiksi kentässä.
const codeInput = ref(typeof route.query.koodi === 'string' ? route.query.koodi : '')
const addMessage = ref('')

const RESULT_MESSAGES: Record<RequestResult, string> = {
  requested: 'Pyyntö lähetetty. Kaveri näkee sen Treeniksessä.',
  accepted: 'Olette nyt kavereita!',
  already_friends: 'Olette jo kavereita.',
  already_requested: 'Pyyntö on jo lähetetty.',
  not_found: 'Koodilla ei löytynyt ketään. Tarkista koodi.',
  self: 'Tämä on oma koodisi.',
}

async function addFriend() {
  const code = parseFriendCode(codeInput.value)
  if (!code) {
    addMessage.value = 'Koodissa on kuusi merkkiä, esimerkiksi K7P2-QX.'
    return
  }
  busy.value = true
  addMessage.value = ''
  try {
    const result = await friends.request(code)
    addMessage.value = RESULT_MESSAGES[result]
    if (result === 'requested' || result === 'accepted') codeInput.value = ''
  } catch {
    addMessage.value = OFFLINE
  } finally {
    busy.value = false
  }
}

async function act(task: () => Promise<void>) {
  busy.value = true
  try {
    await task()
  } catch {
    loadError.value = OFFLINE
  } finally {
    busy.value = false
  }
}

/** Kaveri, jonka poistoa vahvistetaan. Vain yksi kerrallaan. */
const removing = ref<string | null>(null)

// ------------------------------------------------------------- oma koodi

const link = computed(() => (friends.myCode ? `${location.origin}/kaveri/${friends.myCode}` : ''))
const shareMessage = ref('')
const confirmingNewCode = ref(false)

async function share() {
  if (!friends.myCode) return
  const text = `Lisää minut kaveriksi Treeniksessä! Koodini on ${formatFriendCode(friends.myCode)}.`
  shareMessage.value = ''
  if (navigator.share) {
    // Jakovalikon sulkeminen heittää virheen, mutta se ei ole virhe käyttäjälle.
    await navigator.share({ text, url: link.value }).catch(() => undefined)
    return
  }
  try {
    await navigator.clipboard.writeText(`${text} ${link.value}`)
    shareMessage.value = 'Kopioitu leikepöydälle.'
  } catch {
    shareMessage.value = 'Kopiointi ei onnistunut. Kerro koodi kaverillesi.'
  }
}

async function newCode() {
  confirmingNewCode.value = false
  await act(() => friends.regenerateCode())
  shareMessage.value = 'Uusi koodi on käytössä. Vanha ei enää toimi.'
}
</script>

<template>
  <div class="flex flex-col gap-4 px-5 pt-6 pb-6">
    <RouterLink
      to="/kaverit"
      aria-label="Takaisin kaverien treeneihin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>
    <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Hallitse kavereita</h1>

    <p v-if="!auth.name" class="rounded-(--radius-card) bg-surface p-3.5 text-[15px]">
      Lisää ensin nimesi, jotta kaverit tunnistavat sinut.
      <RouterLink to="/asetukset/ulkoasu" class="font-semibold underline">Asetuksiin</RouterLink>
    </p>

    <div v-if="loadError" role="alert" class="rounded-(--radius-card) bg-surface p-3.5">
      <p class="text-[15px]">{{ loadError }}</p>
      <button
        type="button"
        class="mt-3 min-h-11 w-full rounded-(--radius-button) border border-line font-semibold"
        @click="load"
      >
        Yritä uudelleen
      </button>
    </div>

    <p v-if="!friends.loaded && !loadError" role="status" class="text-[15px] text-ink-muted">Haetaan kavereita…</p>

    <template v-if="friends.loaded">
      <section aria-labelledby="kaverit">
        <h2 id="kaverit" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Kaverisi
        </h2>
        <div class="mt-2.5 rounded-(--radius-feature) bg-surface px-4 py-1.5">
          <p v-if="!lists.friends.length && !lists.outgoing.length" class="py-2.5 text-[15px] text-ink-muted">
            Ei vielä kavereita. Jaa oma koodisi tai lisää kaverin koodi.
          </p>
          <ul>
            <li
              v-for="person in lists.friends"
              :key="person.friendshipId"
              class="border-t border-line py-2.5 first:border-t-0"
            >
              <div class="flex items-center gap-2">
                <span class="min-w-0 flex-1 truncate text-[15px] font-semibold">{{ person.name }}</span>
                <button
                  v-if="removing !== person.friendshipId"
                  type="button"
                  class="min-h-11 px-2 text-sm font-semibold text-ink-muted underline"
                  @click="removing = person.friendshipId"
                >
                  Poista
                </button>
              </div>
              <div v-if="removing === person.friendshipId" class="mt-1">
                <p class="text-[13px]">Poistetaanko {{ person.name }} kavereista? Hän ei saa siitä ilmoitusta.</p>
                <div class="mt-2 flex gap-2">
                  <button
                    type="button"
                    class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
                    @click="removing = null"
                  >
                    Peruuta
                  </button>
                  <button
                    type="button"
                    :disabled="busy"
                    class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action disabled:opacity-60"
                    @click="act(() => friends.remove(person.friendshipId))"
                  >
                    Poista
                  </button>
                </div>
              </div>
            </li>
            <li
              v-for="person in lists.outgoing"
              :key="person.friendshipId"
              class="flex items-center gap-2 border-t border-line py-2.5 first:border-t-0"
            >
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">{{ person.name }}</span>
                <span class="block text-[13px] text-ink-muted">Odottaa vastausta</span>
              </span>
              <button
                type="button"
                :disabled="busy"
                class="min-h-11 px-2 text-sm font-semibold text-ink-muted underline disabled:opacity-60"
                @click="act(() => friends.remove(person.friendshipId))"
              >
                Peru
              </button>
            </li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="lisaa">
        <h2 id="lisaa" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Lisää kaveri</h2>
        <form class="mt-2.5 rounded-(--radius-feature) bg-surface p-4" @submit.prevent="addFriend">
          <label for="kaverikoodi" class="text-[15px]">Kaverin koodi tai linkki</label>
          <div class="mt-2 flex gap-2">
            <input
              id="kaverikoodi"
              v-model="codeInput"
              type="text"
              autocapitalize="characters"
              autocomplete="off"
              spellcheck="false"
              placeholder="Esim. AB3D-9Z"
              class="h-11 min-w-0 flex-1 rounded-(--radius-field) border border-line bg-bg px-3 text-base tracking-[0.08em] uppercase placeholder:tracking-normal placeholder:normal-case placeholder:text-ink-muted"
            />
            <button
              type="submit"
              :disabled="busy || !codeInput.trim()"
              class="min-h-11 rounded-(--radius-button) bg-action px-4 font-semibold text-on-action disabled:opacity-40"
            >
              Lähetä
            </button>
          </div>
          <p v-if="addMessage" role="status" class="mt-2 text-[13px]">{{ addMessage }}</p>
        </form>
      </section>

      <section v-if="friends.myCode" aria-labelledby="oma-koodi">
        <h2 id="oma-koodi" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Oma kaverikoodi
        </h2>
        <div class="mt-2.5 rounded-(--radius-feature) bg-surface p-4">
          <p class="font-display text-[34px] leading-none font-bold tracking-[0.06em] tabular-nums">
            {{ formatFriendCode(friends.myCode) }}
          </p>
          <p class="mt-2 text-[13px] text-ink-muted">
            Kaveri liittää koodin omaan Treenikseensä. Pyyntö tulee sinulle hyväksyttäväksi.
          </p>
          <button
            type="button"
            class="mt-3 min-h-11 w-full rounded-(--radius-button) bg-action font-semibold text-on-action"
            @click="share"
          >
            Jaa koodi
          </button>
          <p v-if="shareMessage" role="status" class="mt-2 text-[13px]">{{ shareMessage }}</p>

          <template v-if="confirmingNewCode">
            <p class="mt-3 text-[13px]">
              Vanha koodi lakkaa toimimasta. Nykyiset kaverisi pysyvät.
            </p>
            <div class="mt-2 flex gap-2">
              <button
                type="button"
                class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
                @click="confirmingNewCode = false"
              >
                Peruuta
              </button>
              <button
                type="button"
                :disabled="busy"
                class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold disabled:opacity-60"
                @click="newCode"
              >
                Vaihda koodi
              </button>
            </div>
          </template>
          <button
            v-else
            type="button"
            class="mt-1 min-h-11 text-sm font-semibold text-ink-muted underline"
            @click="confirmingNewCode = true"
          >
            Vaihda koodi
          </button>
        </div>
      </section>

      <RouterLink to="/asetukset/ulkoasu" class="inline-flex min-h-11 items-center self-start text-sm text-ink-muted underline">
        Mitä kaverit näkevät
      </RouterLink>
    </template>
  </div>
</template>
