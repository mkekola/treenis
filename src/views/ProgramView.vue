<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SportIcon from '@/components/SportIcon.vue'
import { useTheme } from '@/composables/useTheme'
import { templatesOf } from '@/lib/program'
import { exerciseCount } from '@/lib/template'
import { useExercises } from '@/stores/exercises'
import { usePrograms } from '@/stores/programs'
import { sportVars, useSportColors } from '@/stores/sportColors'
import { useTemplates } from '@/stores/templates'
import type { WorkoutTemplate } from '@/types/workout'

const route = useRoute()
const router = useRouter()
const programs = usePrograms()
const templates = useTemplates()
const exercises = useExercises()
const colors = useSportColors()
const { isDark } = useTheme()

const vars = computed(() => sportVars(colors.swatchFor('strength'), isDark.value))

const program = computed(() => programs.byId(String(route.params.id)))
const isActive = computed(() => program.value !== undefined && programs.active?.id === program.value.id)
const list = computed(() => (program.value ? templatesOf(program.value, templates.templates) : []))

/** Liikkeiden nimet kortille, jotta treenit erottaa toisistaan avaamatta. */
const summary = (template: WorkoutTemplate) =>
  template.blocks
    .flatMap((block) => block.exercises)
    .map((entry) => exercises.byId.get(entry.exerciseId)?.name ?? 'Tuntematon liike')
    .join(', ')

// ------------------------------------------------------------------- nimi

const nameText = ref(program.value?.name ?? '')
const nameInput = useTemplateRef<HTMLInputElement>('nameInput')

watch(
  () => program.value?.name,
  (name) => {
    if (name !== undefined) nameText.value = name
  },
)

function commitName() {
  if (!program.value) return
  const name = nameText.value.trim()
  if (!name) {
    nameText.value = program.value.name
    return
  }
  if (name !== program.value.name) void programs.save({ ...program.value, name })
}

// Uusi ohjelma avautuu nimi valittuna, jotta "Uusi ohjelma" korvautuu kirjoittamalla.
onMounted(async () => {
  if (route.query.uusi !== '1') return
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
})

// ------------------------------------------------------------ toiminnot

async function addWorkout() {
  if (!program.value) return
  const id = await programs.createTemplate(program.value.id)
  if (id) {
    await router.push({
      name: 'template-edit',
      params: { programId: program.value.id, id },
      query: { uusi: '1' },
    })
  }
}

const confirmingDelete = ref(false)

async function deleteProgram() {
  if (!program.value) return
  await programs.remove(program.value.id)
  await router.replace({ name: 'programs' })
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-3 px-5 pt-5" :style="vars">
    <RouterLink
      :to="{ name: 'programs' }"
      aria-label="Takaisin ohjelmiin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </RouterLink>

    <p v-if="!program" class="py-6 text-center text-sm text-ink-muted">
      Ohjelmaa ei löytynyt. Se on ehkä poistettu toisella laitteella.
    </p>

    <template v-else>
      <label for="ohjelman-nimi" class="sr-only">Ohjelman nimi</label>
      <input
        id="ohjelman-nimi"
        ref="nameInput"
        v-model="nameText"
        type="text"
        enterkeyhint="done"
        class="-mx-2 rounded-(--radius-field) bg-transparent px-2 py-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em] focus:bg-surface"
        @change="commitName"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
      />

      <p
        v-if="isActive"
        class="flex items-center gap-2 text-[13px] text-ink-muted"
      >
        <span
          class="rounded-full bg-[var(--sport-surface)] px-2 py-0.5 text-[11px] font-bold tracking-[0.04em] text-[var(--sport-on)] uppercase"
        >
          Käytössä
        </span>
        Treenit tulevat ensimmäisinä, kun aloitat salitreenin.
      </p>
      <button
        v-else
        type="button"
        class="min-h-12 rounded-(--radius-button) bg-action font-semibold text-on-action"
        @click="programs.makeActive(program.id)"
      >
        Ota käyttöön
      </button>

      <h2 class="mt-2 text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">
        Treenit
      </h2>

      <RouterLink
        v-for="template in list"
        :key="template.id"
        :to="{ name: 'template-edit', params: { programId: program.id, id: template.id } }"
        class="flex items-center gap-3 rounded-(--radius-card) bg-surface p-3.5"
      >
        <span
          aria-hidden="true"
          class="flex size-13 flex-none items-center justify-center rounded-full bg-[var(--sport-surface)] text-[var(--sport-on)]"
        >
          <SportIcon sport="strength" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-[17px] font-semibold tracking-[-0.01em]">{{ template.name }}</span>
          <span class="mt-0.5 block text-[13px] text-ink-muted" data-numeric>
            {{ exerciseCount(template) }} liikettä
          </span>
          <span v-if="exerciseCount(template)" class="block truncate text-[13px] text-ink-muted">
            {{ summary(template) }}
          </span>
        </span>
        <svg class="size-[18px] flex-none text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="9,6 15,12 9,18" />
        </svg>
      </RouterLink>

      <p v-if="!list.length" class="text-[13px] text-ink-muted">
        Ei vielä treenejä. Lisää ensimmäinen, esimerkiksi ylä- tai alakropan päivä.
      </p>

      <button
        type="button"
        class="mt-1 flex min-h-13 items-center justify-center rounded-(--radius-button) border border-dashed border-ink-muted text-base font-semibold"
        @click="addWorkout"
      >
        + Lisää treeni
      </button>

      <!-- Poisto vahvistetaan: se vie ohjelman treenit mukanaan. -->
      <div class="mt-4 mb-6">
        <button
          v-if="!confirmingDelete"
          type="button"
          class="min-h-11 w-full text-sm font-semibold text-ink-muted underline"
          @click="confirmingDelete = true"
        >
          Poista ohjelma
        </button>
        <div v-else class="rounded-(--radius-card) bg-surface p-3.5">
          <p class="text-[15px]">
            Poistetaanko {{ program.name }} ja sen {{ list.length }} treeniä? Tehdyt treenit
            säilyvät päiväkirjassa.
          </p>
          <div class="mt-3 flex gap-2">
            <button
              type="button"
              class="min-h-11 flex-1 rounded-(--radius-button) border border-line font-semibold"
              @click="confirmingDelete = false"
            >
              Peruuta
            </button>
            <button
              type="button"
              class="min-h-11 flex-1 rounded-(--radius-button) bg-action font-semibold text-on-action"
              @click="deleteProgram"
            >
              Poista
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
