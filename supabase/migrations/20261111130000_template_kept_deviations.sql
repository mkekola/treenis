-- Toistuvat poikkeamat, joihin käyttäjä vastasi "Pidä vanha". Sovellus ei
-- kysy niistä uudelleen niin kauan kuin poikkeama jatkuu. Oletus on tyhjä
-- lista, joten vanhat rivit jäävät kelvollisiksi.

alter table public.templates
  add column kept_deviations text[] not null default '{}';
