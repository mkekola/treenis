<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// Sivulle tullaan kirjautumisesta tai asetuksista, joten palataan sinne, mistä tultiin.
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
    <button
      type="button"
      aria-label="Takaisin"
      class="flex size-11 items-center justify-center rounded-full border border-line bg-surface"
      @click="goBack"
    >
      <svg class="size-[19px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="11,6 5,12 11,18" />
      </svg>
    </button>

    <header>
      <h1 class="-mt-1 font-display text-[30px] leading-[1.05] font-bold tracking-[-0.02em]">Tietosuoja</h1>
      <p class="mt-2 text-sm text-ink-muted">Päivitetty 14.11.2026</p>
    </header>

    <div class="flex max-w-[65ch] flex-col gap-6 text-[15px] leading-relaxed [&_h2]:mb-1.5 [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:tracking-[0.06em] [&_h2]:text-ink-muted [&_h2]:uppercase [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
      <section>
        <p>
          Treenis on henkilökohtainen treenipäiväkirja, jota käyttävät vain kutsutut. Tietojasi
          käytetään vain sovelluksen toimintaan. Treeniksessä ei ole mainoksia eikä analytiikkaa,
          eikä tietoja myydä tai luovuteta eteenpäin.
        </p>
      </section>

      <section>
        <h2>Rekisterinpitäjä</h2>
        <p>Maria Kekola</p>
        <p><a href="mailto:maria.kekola@gmail.com" class="underline">maria.kekola@gmail.com</a></p>
      </section>

      <section>
        <h2>Mitä tietoja käsitellään</h2>
        <ul>
          <li><strong class="font-semibold">Sähköpostiosoite ja nimi:</strong> kirjautumiseen ja siihen, että kaverisi tunnistavat sinut.</li>
          <li><strong class="font-semibold">Treenit:</strong> kirjaamasi treenit, ohjelmat, treenipohjat, omat liikkeet ja muistiinpanot.</li>
          <li><strong class="font-semibold">Strava</strong>, jos yhdistät sen: yhteyden tunnisteet ja aktiviteettisi tiedot, kuten laji, aika, kesto, matka ja syke.</li>
          <li><strong class="font-semibold">Kaverit:</strong> kaverisuhteet, reaktiot, haasteet ja jakamisasetuksesi.</li>
        </ul>
        <p class="mt-2">
          Käsittely perustuu siihen, että käytät sovellusta. Syke on terveystieto, ja sitä käsitellään
          vain, jos kirjaat sen itse tai yhdistät Stravan. Voit lopettaa sen milloin tahansa
          katkaisemalla Strava-yhteyden.
        </p>
      </section>

      <section>
        <h2>Mitä kaverit näkevät</h2>
        <p>
          Kaverit näkevät vain sen, minkä sallit jakamisasetuksissa. Stravasta tuodut treenit näkyvät
          kavereille vain, jos erikseen sallit sen, ja silloinkin vain laji, päivä, kesto ja matka:
          ei sykettä, karttoja eikä sijaintia. Haasteissa osallistujat näkevät toistensa nimet ja
          tulokset. Muistiinpanot eivät näy kenellekään muulle.
        </p>
      </section>

      <section>
        <h2>Missä tiedot ovat</h2>
        <ul>
          <li><strong class="font-semibold">Supabase:</strong> tietokanta ja kirjautuminen, palvelimet Ruotsissa (EU).</li>
          <li><strong class="font-semibold">Resend:</strong> lähettää kirjautumiskoodit ja käsittelee sitä varten sähköpostiosoitteesi.</li>
          <li><strong class="font-semibold">Netlify:</strong> sivuston palvelin. Se tallentaa tavalliset palvelinlokit, kuten IP-osoitteen.</li>
          <li><strong class="font-semibold">Ilmoitukset</strong>, jos otat ne käyttöön: laitteesi ilmoitusosoite tallennetaan, ja ilmoitukset kulkevat Applen tai Googlen ilmoituspalvelun kautta. Voit poistaa ne käytöstä asetuksista.</li>
          <li><strong class="font-semibold">Oma laitteesi:</strong> treenit tallentuvat myös puhelimeen, jotta Treenis toimii ilman verkkoa, ja kirjautuminen muistetaan. Seurantaevästeitä ei käytetä.</li>
        </ul>
      </section>

      <section>
        <h2>Strava</h2>
        <p>
          Stravasta tuodut tiedot näkyvät oletuksena vain sinulle, eikä niitä käytetä tekoälyyn. Kun katkaiset
          yhteyden asetuksista, Strava-yhteys ja tuodut aktiviteetit poistetaan. Päiväkirjaan jo
          tuodut treenit jäävät, kunnes poistat ne itse.
        </p>
      </section>

      <section>
        <h2>Säilytys ja oikeutesi</h2>
        <p>
          Tiedot säilyvät niin kauan kuin tilisi on olemassa. Voit ladata omat tietosi tiedostona
          asetuksista (Omat tietosi). Sähköpostilla voit pyytää tietojesi korjaamista tai tilisi ja
          kaikkien tietojesi poistamista. Jos koet, että
          tietojasi käsitellään väärin, voit tehdä valituksen
          <a href="https://tietosuoja.fi" target="_blank" rel="noopener" class="underline">tietosuojavaltuutetulle</a>.
        </p>
      </section>
    </div>
  </div>
</template>
