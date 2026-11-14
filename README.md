<h1>
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/logo-dark.svg">
    <img src=".github/logo-light.svg" alt="Treenis" width="240">
  </picture>
</h1>

Treenipäiväkirja salille, lenkeille ja kaikelle siltä väliltä. Toimii puhelimessa kotivalikkoon lisättävänä web-sovelluksena (PWA), myös ilman verkkoyhteyttä.

## Miksi

Kuntosali- ja treenisovelluksia on satoja, mutta en löytänyt yhtäkään, joka yhdistäisi tarkan sarjojen kirjauksen ja kaiken muun liikkumisen. Halusin kaikki treenit ja niiden kehityksen samaan paikkaan.

En myöskään halunnut maksaa usean eri sovelluksen tilauksista tai katsella typeriä mainoksia. Joten tein oman :)

## Mitä sillä tekee

- **Salitreeni:** ohjelmat ja treenipohjat, sarjat toistoineen ja painoineen, supersarjat, lepoajastin ja painoehdotus edellisen kerran tuntuman perusteella.
- **Muut lajit:** juoksu, kävely, pyöräily, uinti, jooga ja muut kirjataan käsin, myös jälkikäteen.
- **Strava:** aktiviteetit tulevat Stravasta automaattisesti.
- **Tilastot:** kalenteri viikko-, kuukausi- ja vuosinäkymällä, viikkoputki, lajien tasapaino, salikehitys ja kestävyysmäärät.
- **Offline:** treenit tallentuvat ensin puhelimeen ja synkronoituvat, kun verkko palaa.

Treenis on henkilökohtainen työkalu, joten kirjautuminen on vain kutsutuille.

## Tekniikka

Vue 3 + TypeScript + Vite, Tailwind CSS, Pinia, Vue Router, Dexie (IndexedDB), vite-plugin-pwa ja Supabase (Postgres, Auth, Edge Functions). Kaaviot on piirretty SVG:nä ilman kaaviokirjastoa. Testit Vitestillä.

## Kehitys

```bash
npm install
npm run dev      # kehityspalvelin
npm test         # testit
npm run build    # tuotantoversio dist/-kansioon
```

Sovellus tarvitsee Supabase-projektin tiedot tiedostoon `.env.local`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

Tietokannan migraatiot ovat kansiossa `supabase/migrations/` ja Strava-integraation Edge Function kansiossa `supabase/functions/strava/`. Funktio tarvitsee Supabasen Secrets-asetuksiin arvot `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` ja `STRAVA_WEBHOOK_VERIFY_TOKEN`.

Strava-data haetaan Stravan API:n kautta. Treenis ei ole Stravan tekemä eikä hyväksymä.
