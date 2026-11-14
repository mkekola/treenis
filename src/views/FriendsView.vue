<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ChallengeCard from '@/components/ChallengeCard.vue'
import FeedCard from '@/components/FeedCard.vue'
import PoweredByStrava from '@/components/PoweredByStrava.vue'
import { sortChallenges } from '@/lib/challenges'
import type { ReactionKey } from '@/lib/feed'
import { localDate } from '@/lib/session'
import { useChallenges } from '@/stores/challenges'
import { useFeed } from '@/stores/feed'
import { useFriends } from '@/stores/friends'

// Kaverien treenit ja saapuneet pyynnöt. Kaverien lisäys ja koodi ovat omalla
// sivullaan (FriendsManageView), jotta ne eivät vie tilaa syötteeltä.
const friends = useFriends()
const feed = useFeed()
const challenges = useChallenges()

const loadError = ref('')
const busy = ref(false)
const lists = computed(() => friends.lists)
const hasStravaData = computed(() => feed.rows.some((row) => row.from_strava))

async function load() {
  loadError.value = ''
  try {
    await Promise.all([friends.load(), feed.load(), challenges.load()])
  } catch {
    loadError.value = 'Kaverit tarvitsevat verkkoyhteyden. Kokeile uudelleen.'
  }
}

onMounted(load)

async function respond(friendshipId: string, accept: boolean) {
  busy.value = true
  try {
    await friends.respond(friendshipId, accept)
    // Hyväksytyn kaverin treenit näkyvät heti.
    if (accept) await feed.load()
  } catch {
    loadError.value = 'Vastaus ei tallentunut. Tarkista verkkoyhteys.'
  } finally {
    busy.value = false
  }
}

// Kutsut ensin, päättyneet viimeisenä.
const sortedChallenges = computed(() => sortChallenges(challenges.rows, localDate(new Date())))

const challengeError = ref('')

async function challengeAction(task: () => Promise<void>) {
  challengeError.value = ''
  try {
    await task()
  } catch {
    challengeError.value = 'Muutos ei tallentunut. Tarkista verkkoyhteys.'
  }
}

const reactError = ref('')

async function react(workoutId: string, key: ReactionKey) {
  reactError.value = ''
  try {
    await feed.react(workoutId, key)
  } catch {
    reactError.value = 'Reaktio ei tallentunut. Tarkista verkkoyhteys.'
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 px-5 pt-6 pb-6">
    <div class="flex items-center justify-between gap-3">
      <h1 class="font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Kaverit</h1>
      <div class="flex gap-2">
        <RouterLink
          v-if="lists.friends.length"
          to="/kaverit/haaste"
          class="inline-flex min-h-11 items-center rounded-(--radius-button) border border-line px-4 text-sm font-semibold"
        >
          + Haaste
        </RouterLink>
        <RouterLink
          to="/kaverit/hallitse"
          class="inline-flex min-h-11 items-center rounded-(--radius-button) border border-line px-4 text-sm font-semibold"
        >
          Hallitse
        </RouterLink>
      </div>
    </div>

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
      <!-- Saapuneet pyynnöt ylimpänä: ne odottavat sinun toimintaasi. -->
      <section v-if="lists.incoming.length" aria-labelledby="pyynnot">
        <h2 id="pyynnot" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Pyynnöt</h2>
        <ul class="mt-2.5 rounded-(--radius-feature) bg-surface px-4 py-1.5">
          <li
            v-for="person in lists.incoming"
            :key="person.friendshipId"
            class="flex items-center gap-2 border-t border-line py-2.5 first:border-t-0"
          >
            <span class="min-w-0 flex-1 truncate text-[15px] font-semibold">{{ person.name }}</span>
            <button
              type="button"
              :disabled="busy"
              class="min-h-11 rounded-(--radius-button) border border-line px-4 font-semibold disabled:opacity-60"
              @click="respond(person.friendshipId, false)"
            >
              Hylkää
            </button>
            <button
              type="button"
              :disabled="busy"
              class="min-h-11 rounded-(--radius-button) bg-action px-4 font-semibold text-on-action disabled:opacity-60"
              @click="respond(person.friendshipId, true)"
            >
              Hyväksy
            </button>
          </li>
        </ul>
      </section>

      <!-- Haasteet ennen syötettä: kutsut odottavat vastausta ja käynnissä olevaa seurataan. -->
      <section v-if="challenges.rows.length" aria-labelledby="haasteet">
        <h2 id="haasteet" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Haasteet</h2>
        <p v-if="challengeError" role="alert" class="mt-2 text-[13px] font-semibold">{{ challengeError }}</p>
        <div class="mt-2.5 flex flex-col gap-2">
          <ChallengeCard
            v-for="row in sortedChallenges"
            :key="row.id"
            :row="row"
            @respond="challengeAction(() => challenges.respond(row.id, $event))"
            @leave="challengeAction(() => challenges.leave(row.id))"
          />
        </div>
      </section>

      <section v-if="lists.friends.length && feed.loaded" aria-labelledby="syote">
        <h2 id="syote" class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
          Kahden viikon treenit
        </h2>
        <p v-if="reactError" role="alert" class="mt-2 text-[13px] font-semibold">{{ reactError }}</p>
        <div class="mt-2.5 flex flex-col gap-2">
          <FeedCard
            v-for="row in feed.rows"
            :key="row.workout_id"
            :row="row"
            @react="react(row.workout_id, $event)"
          />
          <p v-if="!feed.rows.length" class="rounded-(--radius-card) bg-surface p-3.5 text-[15px] text-ink-muted">
            Ei vielä treenejä kahden viikon ajalta.
          </p>
          <!-- Stravan brändiohjeet: merkki siellä, missä Strava-dataa näytetään. -->
          <PoweredByStrava v-if="hasStravaData" class="mt-1.5 self-center" />
        </div>
      </section>

      <!-- Ilman kavereita syötteessä olisi vain omia treenejä, joten ohjataan lisäämään. -->
      <div v-else-if="!lists.friends.length" class="rounded-(--radius-feature) bg-surface p-4">
        <p class="text-[15px]">Lisää kavereita, niin näet heidän treeninsä ja voit tsempata toisianne.</p>
        <RouterLink
          to="/kaverit/hallitse"
          class="mt-3 flex min-h-11 items-center justify-center rounded-(--radius-button) bg-action font-semibold text-on-action"
        >
          Lisää kaveri
        </RouterLink>
      </div>
    </template>
  </div>
</template>
