-- Ohjelman tiedot: väri ohjelmapaletista, kesto viikkoina ja taso.
-- Kaikki ovat valinnaisia: vanhat rivit jäävät kelvollisiksi, ja sovellus
-- käyttää oletuksia, kun tietoa ei ole.

alter table public.programs
  add column color text check (color in (
    'luumu', 'sammal', 'savi', 'muste', 'petrooli', 'okra', 'grafiitti'
  )),
  add column duration_weeks smallint check (duration_weeks between 1 and 52),
  add column level text check (level in ('beginner', 'intermediate', 'advanced'));
