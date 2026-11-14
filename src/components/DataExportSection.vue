<script setup lang="ts">
import { ref } from 'vue'
import { exportJson, workoutsCsv } from '@/lib/export'
import { localDate } from '@/lib/session'
import { useExercises } from '@/stores/exercises'
import { usePrograms } from '@/stores/programs'
import { useTemplates } from '@/stores/templates'
import { useWorkouts } from '@/stores/workouts'

// Tiedosto tehdään laitteen omista tiedoista, joten vienti toimii myös ilman verkkoa.
const workouts = useWorkouts()
const templates = useTemplates()
const programs = usePrograms()
const exercises = useExercises()
const message = ref('')

/**
 * Puhelimessa jakovalikko (iPhonen kotivalikon sovellus ei osaa ladata tiedostoa suoraan),
 * tietokoneella tavallinen lataus.
 */
async function save(content: string, filename: string, type: string) {
  message.value = ''
  const file = new File([content], filename, { type })
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    // Jakovalikon sulkeminen heittää virheen, mutta se ei ole virhe käyttäjälle.
    await navigator.share({ files: [file] }).catch(() => undefined)
    return
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // Osa selaimista lataa vain sivulla olevasta linkistä, ja osoite vapautetaan vasta
  // latauksen alettua, muuten selain ehtii perua sen.
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  message.value = `Ladattu: ${filename}`
}

const today = () => localDate(new Date())

function downloadJson() {
  const content = exportJson(
    {
      workouts: workouts.workouts,
      templates: templates.templates,
      programs: programs.programs,
      customExercises: exercises.custom,
    },
    new Date(),
  )
  save(content, `treenis-${today()}.json`, 'application/json')
}

function downloadCsv() {
  const nameOf = (id: string) => exercises.byId.get(id)?.name ?? id
  save(workoutsCsv(workouts.workouts, nameOf), `treenis-treenit-${today()}.csv`, 'text/csv')
}
</script>

<template>
  <section class="rounded-(--radius-feature) bg-surface p-3.5">
    <h2 class="text-[13px] font-semibold tracking-[0.06em] text-ink-muted uppercase">Omat tietosi</h2>
    <p class="mt-2 text-[13px] text-ink-muted">
      Treenisi, ohjelmasi ja omat liikkeesi tiedostona. JSON sopii varmuuskopioksi, taulukko
      Exceliin tai Numbersiin.
    </p>
    <div class="mt-3 flex flex-col gap-2">
      <button
        type="button"
        class="min-h-11 rounded-(--radius-button) border border-line font-semibold"
        @click="downloadJson"
      >
        Lataa kaikki (JSON)
      </button>
      <button
        type="button"
        class="min-h-11 rounded-(--radius-button) border border-line font-semibold"
        @click="downloadCsv"
      >
        Lataa treenit taulukkona (CSV)
      </button>
    </div>
    <p v-if="message" role="status" class="mt-2 text-[13px]">{{ message }}</p>
  </section>
</template>
