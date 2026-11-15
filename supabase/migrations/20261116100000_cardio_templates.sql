-- Kestävyyspohjat: pohjalla voi olla laji (juoksu, kävely, pyöräily…) ja osiot, kuten
-- "Vedot 6 × 400 m, palautus 90 s". Salipohjat ovat 'strength' ilman osioita, joten
-- olemassa olevat pohjat pysyvät ennallaan. Vanha sovellusversio ei lähetä näitä
-- sarakkeita, jolloin ne säilyvät tallennuksessa koskemattomina.

alter table public.templates
  add column sport text not null default 'strength',
  add column segments jsonb not null default '[]'::jsonb;
